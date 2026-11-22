// index.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const PgSessionStore = require('connect-pg-simple')(session);
const pool = require('./db');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  requireRole, actor, apiGate, refreshSessionUser, sameOriginWrites, employeeChangeDenied, redactLogChanges,
  MANAGERS, ASSIGNABLE_LEVELS, ALLOWED_ORIGINS, SESSION_COOKIE, COOKIE_OPTIONS,
} = require('./lib/auth');
const { parsePort, parseTrustProxy, orExit } = require('./lib/config');
const uploads = require('./lib/uploads');
const { isBookingCodeConflict, withBookingCode } = require('./lib/bookingCode');
const { LOOKUP_SQL, parseLookupQuery } = require('./lib/customerLookup');
const { LOYALTY_SQL } = require('./lib/loyalty');
const { deliverEmail } = require('./lib/mailer');
const {
  WEB_CONFIG_FIELDS, FIELD_BY_KEY, parseWebConfigInput, rowsToConfig, publicConfig, signatoryFrom,
} = require('./lib/webConfig');
const { computeTotals } = require('./project/src/lib/pricing.mjs');
const { generateInvoiceEmail } = require('./project/src/components/emailTemplates/invoiceTemplate.cjs');
const { generateReceiptEmail, generateReceiptText } = require('./project/src/components/emailTemplates/receiptTemplate.cjs');
const { ADMIN_WHATSAPP, SIGNATORY } = require('./project/src/components/emailTemplates/brand.cjs');
const { safeSubject } = require('./project/src/components/emailTemplates/htmlSafe.cjs');

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('SESSION_SECRET wajib diisi di .env, minimal 32 karakter.');
  process.exit(1);
}
const PORT = orExit(() => parsePort(process.env.PORT));
const TRUST_PROXY = orExit(() => parseTrustProxy(process.env.TRUST_PROXY));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const app = express();
// Match nginx's login rate limit: /api/Login must not reach the same handler as /api/login.
app.set('case sensitive routing', true);
app.disable('x-powered-by');
// Behind nginx the hop count lets req.secure follow X-Forwarded-Proto; without it
// express-session refuses to send the secure cookie and login fails silently.
if (TRUST_PROXY > 0) app.set('trust proxy', TRUST_PROXY);

// Sessions live in Postgres so a container restart does not log everyone out.
const sessionStore = new PgSessionStore({
  pool,
  tableName: process.env.SESSION_TABLE || 'app_session',
  createTableIfMissing: false,
  errorLog: (...args) => console.error('Session store error:', ...args),
});

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(session({
  name: SESSION_COOKIE,
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { ...COOKIE_OPTIONS, maxAge: 8 * 60 * 60 * 1000 },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiGate);
app.use('/api', sameOriginWrites(ALLOWED_ORIGINS));

// Every :id in this API is a uuid; rejecting others early avoids pg 22P02 turning into a 500.
app.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) return res.status(400).json({ message: 'ID tidak valid.' });
  return next();
});

// Out-of-range or non-numeric values fall back to the default instead of reaching LIMIT/OFFSET.
function parsePaging(query, defaultLimit = 5) {
  const limit = Number(query.limit);
  const offset = Number(query.offset);
  return {
    limit: Number.isInteger(limit) && limit >= 1 && limit <= 100 ? limit : defaultLimit,
    offset: Number.isInteger(offset) && offset >= 0 ? offset : 0,
  };
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const HEALTH_TIMEOUT_MS = 2000;
app.get('/api/health', async (req, res) => {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`select 1 lebih dari ${HEALTH_TIMEOUT_MS} ms`)), HEALTH_TIMEOUT_MS);
  });
  try {
    await Promise.race([pool.query('select 1'), timeout]);
    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('Health check gagal:', err.message);
    return res.status(503).json({ status: 'unavailable' });
  } finally {
    clearTimeout(timer);
  }
});

app.get('/', (req, res) => {
  res.send('Andi Rental API is running.');
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
  }
  try {
    const result = await pool.query('select id, username, level, password from dim_user where username = $1', [username]);
    const user = result.rows[0];
    const valid = user ? await bcrypt.compare(password, user.password) : false;
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Username atau password salah' });
    }
    // New session id on login so a pre-login cookie cannot be reused (session fixation).
    req.session.regenerate((err) => {
      if (err) {
        console.error('Gagal membuat sesi:', err);
        return res.status(500).json({ success: false, message: 'Login gagal. Coba lagi.' });
      }
      req.session.user = { id: user.id, username: user.username, level: user.level };
      return req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Gagal menyimpan sesi:', saveErr);
          return res.status(500).json({ success: false, message: 'Login gagal. Coba lagi.' });
        }
        return res.json({ success: true, id: user.id, username: user.username, level: user.level });
      });
    });
  } catch (err) {
    console.error('ERROR POST /api/login:', err);
    res.status(500).json({ success: false, message: 'Login gagal. Coba lagi.' });
  }
});

app.get('/api/me', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ loggedIn: false });
  try {
    const user = await refreshSessionUser(req);
    if (user) return res.json({ loggedIn: true, user });
    return req.session.destroy((err) => {
      if (err) console.error('Gagal mengakhiri sesi:', err);
      res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
      res.status(401).json({ loggedIn: false });
    });
  } catch (err) {
    console.error('ERROR GET /api/me:', err);
    return res.status(500).json({ message: 'Terjadi kesalahan di server.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Gagal logout:', err);
      return res.status(500).json({ success: false, message: 'Logout gagal. Coba lagi.' });
    }
    res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
    return res.json({ success: true });
  });
});

app.get('/api/files/:filename', uploads.serveUploadedFile);

// POST /api/cars
app.post('/api/cars', uploads.uploadCarPhotos, async (req, res) => {
  const who = actor(req);
  const {
    name, brand, type, transmission, fuel,
    seats, daily_rate, monthly_rate, deposit, quantity
  } = req.body;

  let colors;
  let plates;
  try {
    colors = JSON.parse(req.body.colors || '[]');
    plates = JSON.parse(req.body.plates || '[]');
  } catch {
    colors = null;
  }
  if (!Array.isArray(colors) || !Array.isArray(plates)) {
    await uploads.removeRequestFiles(req);
    return res.status(400).json({ message: 'Format warna atau plat nomor tidak valid.' });
  }

  const imageFiles = req.files?.image?.map(file => file.filename) || [];
  let saved = false;

  try {
    const result = await pool.query(`
      INSERT INTO dim_car (
        name, brand, type, transmission, fuel,
        seats, daily_rate, monthly_rate, deposit, quantity, image, colors, plates, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *
    `, [
      name, brand, type, transmission, fuel,
      Number(seats), Number(daily_rate), Number(monthly_rate),
      Number(deposit), Number(quantity),
      JSON.stringify(imageFiles),
      JSON.stringify(colors),
      JSON.stringify(plates),
      who.username
    ]);
    saved = true;

    const insertedCar = result.rows[0];

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      insertedCar.id,
      'car',
      'CREATE',
      JSON.stringify({ after: insertedCar, before: null }),
      who.id,
      'Manajemen Mobil'
    ]);

    res.status(201).json(insertedCar);
  } catch (err) {
    console.error('ERROR POST /api/cars:', err);
    if (!saved) await uploads.removeRequestFiles(req);
    res.status(500).json({ message: 'Gagal menyimpan data mobil.' });
  }
});

// PUT /api/cars/:id
app.put('/api/cars/:id', uploads.uploadCarPhotosArray, async (req, res) => {
  const who = actor(req);
  const id = req.params.id;

  let colors;
  let plates;
  try {
    colors = JSON.parse(req.body.colors || '[]');
    plates = JSON.parse(req.body.plates || '[]');
  } catch {
    colors = null;
  }
  if (!Array.isArray(colors) || !Array.isArray(plates)) {
    await uploads.removeRequestFiles(req);
    return res.status(400).json({ message: 'Format warna atau plat nomor tidak valid.' });
  }

  let saved = false;
  try {
    const beforeResult = await pool.query('SELECT * FROM dim_car WHERE id = $1', [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      await uploads.removeRequestFiles(req);
      return res.status(404).json({ message: 'Data mobil tidak ditemukan.' });
    }

    const imageFiles = req.files?.map(file => file.filename) || [];
    const image = imageFiles.length > 0 ? JSON.stringify(imageFiles) : before.image;

    await pool.query(`
      UPDATE dim_car SET
        name = $1,
        brand = $2,
        type = $3,
        transmission = $4,
        fuel = $5,
        seats = $6,
        daily_rate = $7,
        monthly_rate = $8,
        deposit = $9,
        quantity = $10,
        image = $11,
        colors = $12,
        plates = $13,
        updated_at = NOW(),
        updated_by = $14
      WHERE id = $15
    `, [
      req.body.name,
      req.body.brand,
      req.body.type,
      req.body.transmission,
      req.body.fuel,
      Number(req.body.seats),
      Number(req.body.daily_rate),
      Number(req.body.monthly_rate),
      Number(req.body.deposit),
      Number(req.body.quantity),
      image,
      JSON.stringify(colors),
      JSON.stringify(plates),
      who.username,
      id
    ]);
    saved = true;

    if (imageFiles.length > 0) {
      const oldImages = parseJsonList(before.image).filter(name => !imageFiles.includes(name));
      await Promise.all(oldImages.map(uploads.deleteFileIfExists));
    }

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'car',
      'UPDATE',
      JSON.stringify({ before, after: { ...req.body, image, updated_by: who.username } }),
      who.id,
      'Manajemen Mobil'
    ]);

    res.status(200).json({ message: 'Data mobil berhasil diperbarui.' });
  } catch (error) {
    console.error('ERROR PUT /api/cars/:id:', error);
    if (!saved) await uploads.removeRequestFiles(req);
    res.status(500).json({ message: 'Gagal memperbarui data mobil.' });
  }
});

// DELETE /api/cars/:id
app.delete('/api/cars/:id', async (req, res) => {
  const who = actor(req);
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM dim_car WHERE id = $1', [id]);
    const before = result.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Mobil tidak ditemukan.' });
    }

    await pool.query('DELETE FROM dim_car WHERE id = $1', [id]);

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'car',
      'DELETE',
      JSON.stringify({
        before,
        reason: `Dihapus oleh ${who.username}`
      }),
      who.id,
      'Manajemen Mobil'
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('ERROR DELETE /api/cars/:id', err);
    res.status(500).json({ success: false, message: 'Gagal menghapus mobil.' });
  }
});

// GET /api/cars
app.get('/api/cars', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dim_car ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('ERROR GET /api/cars:', err);
    res.status(500).json({ success: false, message: 'Gagal mengambil data mobil.' });
  }
});

// GET /api/cars/:id
app.get('/api/cars/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM dim_car WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Mobil tidak ditemukan.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR GET /api/cars/:id:', err);
    res.status(500).json({ message: 'Gagal mengambil data mobil.' });
  }
});

// booking_code is not read from the body: withBookingCode assigns it at insert time.
const BOOKING_TEXT_FIELDS = ['email', 'name', 'whatsapp', 'address', 'identity_type', 'car_type'];
// Reorder copies these from the locked dim_cust row, so whatever the body says is ignored (N3).
const CUSTOMER_FIELDS = ['email', 'name', 'whatsapp', 'address', 'identity_type', 'company_address'];
const BOOKING_AMOUNT_FIELDS = ['deposit', 'discount', 'trip_fee', 'driver_fee', 'delivery_fee', 'pickup_fee'];
const BOOKING_FLAGS = ['needs_trip', 'needs_driver', 'needs_delivery', 'needs_pickup'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
// Postgres rejects these at insert time (impossible date or time, bad number): bad input, not a server fault.
const PG_INVALID_INPUT = new Set(['22007', '22008', '22P02']);

// Multipart sends strings, the reorder JSON sends numbers and booleans; both land here.
function bodyText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

// Per-field ceiling for any money value; far above a real rental, low enough to catch typos and 1e300.
const AMOUNT_MAX = 10_000_000_000;
// Plain digits with an optional fraction only: Number() alone would accept '1e3', '0x10' and 'Infinity'.
const PLAIN_DECIMAL_RE = /^\d+(\.\d+)?$/;
const PLAIN_INTEGER_RE = /^\d+$/;

function parseAmount(value, required = false) {
  const raw = bodyText(value);
  if (raw === '') {
    const empty = value === undefined || value === null || value === '';
    return { ok: empty && !required, value: 0 };
  }
  const n = Number(raw);
  return { ok: PLAIN_DECIMAL_RE.test(raw) && n <= AMOUNT_MAX, value: n };
}

// Returns the cleaned booking plus every invalid field name; nothing is written before this passes.
function parseBookingBody(body) {
  const invalid = new Set();
  const data = {};

  for (const key of BOOKING_TEXT_FIELDS) {
    data[key] = bodyText(body[key]);
    if (!data[key]) invalid.add(key);
  }
  data.company_address = bodyText(body.company_address) || null;
  data.purpose = bodyText(body.purpose) || null;

  data.rental_duration = bodyText(body.rental_duration);
  if (!['daily', 'monthly'].includes(data.rental_duration)) invalid.add('rental_duration');

  const rangeRent = bodyText(body.range_rent);
  data.range_rent = Number(rangeRent);
  if (!PLAIN_INTEGER_RE.test(rangeRent) || data.range_rent < 1) invalid.add('range_rent');

  for (const key of ['start_date', 'end_date']) {
    data[key] = bodyText(body[key]);
    if (!DATE_RE.test(data[key])) invalid.add(key);
  }
  // Same-width YYYY-MM-DD strings sort like dates; impossible days are still left to Postgres.
  if (!invalid.has('start_date') && !invalid.has('end_date') && data.end_date < data.start_date) {
    invalid.add('end_date');
  }
  data.start_time = bodyText(body.start_time) || null;
  if (data.start_time && !TIME_RE.test(data.start_time)) invalid.add('start_time');

  const rentalCost = parseAmount(body.rental_cost, true);
  data.rental_cost = rentalCost.value;
  if (!rentalCost.ok) invalid.add('rental_cost');

  for (const key of BOOKING_AMOUNT_FIELDS) {
    const parsed = parseAmount(body[key]);
    data[key] = parsed.value;
    if (!parsed.ok) invalid.add(key);
  }
  for (const key of BOOKING_FLAGS) {
    data[key] = body[key] === true || body[key] === 'true';
  }

  return { data, invalid: [...invalid] };
}

// grand_total and inactive fees always come from computeTotals; client totals are ignored (K8).
async function insertTransaction(client, data, customerId, who) {
  const totals = computeTotals(data);
  const result = await client.query(`
    insert into fact_transaction (
      booking_code, customer_id, email, rental_duration, range_rent, car_type,
      needs_trip, needs_driver, needs_delivery, needs_pickup,
      start_date, start_time, end_date,
      rental_cost, grand_total, deposit, discount, trip_fee, driver_fee, delivery_fee, pickup_fee,
      purpose, identity_type, name, whatsapp, address, company_address, created_by
    ) values (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21,
      $22, $23, $24, $25, $26, $27, $28
    ) returning *
  `, [
    data.booking_code, customerId, data.email, data.rental_duration, data.range_rent, data.car_type,
    data.needs_trip, data.needs_driver, data.needs_delivery, data.needs_pickup,
    data.start_date, data.start_time, data.end_date,
    totals.rental_cost, totals.grand_total, totals.deposit, totals.discount_applied,
    totals.trip_fee, totals.driver_fee, totals.delivery_fee, totals.pickup_fee,
    data.purpose, data.identity_type, data.name, data.whatsapp, data.address, data.company_address, who.username,
  ]);
  return result.rows[0];
}

async function rollbackQuietly(client) {
  try {
    await client.query('rollback');
  } catch (err) {
    console.error('Rollback gagal:', err.message);
  }
}

function sendBookingError(err, res, label) {
  // Only reached after withBookingCode used up its retries on generated codes.
  if (isBookingCodeConflict(err)) {
    return res.status(409).json({ message: 'Kode booking sudah dipakai.' });
  }
  if (PG_INVALID_INPUT.has(err.code)) {
    return res.status(400).json({ message: `Data ${label} tidak valid.` });
  }
  console.error(`ERROR simpan ${label}:`, err);
  return res.status(500).json({ message: `Gagal menyimpan ${label}.` });
}

// POST /api/booking: customer, transaction and both logs in one DB transaction (K5, K6).
app.post('/api/booking', uploads.uploadDocuments, async (req, res) => {
  const who = actor(req);
  const { data, invalid } = parseBookingBody(req.body || {});
  if (invalid.length > 0) {
    await uploads.removeRequestFiles(req);
    return res.status(400).json({ message: 'Data booking belum lengkap atau tidak valid.', fields: invalid });
  }

  const documents = {};
  for (const [field, files] of Object.entries(req.files || {})) {
    if (files[0]) documents[field] = files[0].filename;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('begin');

    const { customer, transaction } = await withBookingCode(client, async (code) => {
      data.booking_code = code;
      const customerResult = await client.query(`
        insert into dim_cust (
          booking_code, email, identity_type, name, whatsapp, address, company_address, documents, created_by
        ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        returning *
      `, [
        data.booking_code, data.email, data.identity_type, data.name, data.whatsapp,
        data.address, data.company_address, JSON.stringify(documents), who.username,
      ]);
      const created = customerResult.rows[0];
      return { customer: created, transaction: await insertTransaction(client, data, created.id, who) };
    });

    await client.query(`
      insert into history_log (log_id, entity, action, changes, user_id, page)
      values ($1, 'customer', 'CREATE', $2::jsonb, $5, 'Form Booking'),
             ($3, 'transaction', 'CREATE', $4::jsonb, $5, 'Form Booking')
    `, [
      customer.id,
      JSON.stringify({ after: customer, before: null, created_by: who.username }),
      transaction.id,
      JSON.stringify({ after: transaction, before: null, created_by: who.username }),
      who.id,
    ]);

    await client.query('commit');
    return res.status(201).json({ customer, transaction });
  } catch (err) {
    if (client) await rollbackQuietly(client);
    await uploads.removeRequestFiles(req);
    return sendBookingError(err, res, 'booking');
  } finally {
    if (client) client.release();
  }
});

// GET /api/car-types
app.get('/api/car-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand, name FROM dim_car ORDER BY brand, name');

    const carTypes = result.rows.map(row => ({
      label: `${row.brand} ${row.name}`,
      value: `${row.brand} ${row.name}`,
    }));
    res.json(carTypes);
  } catch (err) {
    console.error('ERROR GET /api/car-types:', err);
    res.status(500).json({ success: false });
  }
});

// GET /api/car-rates
app.get('/api/car-rates', async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT brand, name, daily_rate, monthly_rate FROM dim_car ORDER BY brand, name');

    const carRates = result.rows.map(row => ({
      label: `${row.brand} ${row.name}`,
      value: `${row.brand} ${row.name}`,
      daily_rate: row.daily_rate,
      monthly_rate: row.monthly_rate,
    }));
    res.json(carRates);
  } catch (err) {
    console.error('ERROR GET /api/car-rates:', err);
    res.status(500).json({ success: false });
  }
});

// GET /api/customer
app.get('/api/customer', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM dim_cust WHERE deleted = false ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ message: 'Gagal mengambil data customer.' });
  }
});

// GET /api/customer/lookup: returning-customer warning on the booking form. Registered before
// /api/customer/:id so "lookup" is not taken as an id; documents and contact history stay out.
app.get('/api/customer/lookup', async (req, res) => {
  const { email, whatsapp, empty } = parseLookupQuery(req.query);
  if (empty) {
    return res.status(400).json({ message: 'Isi email atau nomor WhatsApp untuk mencari customer.' });
  }
  try {
    const result = await pool.query(LOOKUP_SQL, [email, whatsapp]);
    res.json({ matches: result.rows });
  } catch (err) {
    console.error('ERROR GET /api/customer/lookup:', err);
    res.status(500).json({ message: 'Gagal mencari data customer.' });
  }
});

// PUT /api/customer/:id
app.put('/api/customer/:id', uploads.uploadDocuments, async (req, res) => {
  const who = actor(req);
  const { id } = req.params;
  const {
    name, email, whatsapp, address, identity_type,
    company_address
  } = req.body;

  const documents = {};
  for (const key in req.files) {
    if (req.files[key][0]) {
      documents[key] = req.files[key][0].filename;
    }
  }

  let saved = false;
  try {
    const beforeResult = await pool.query('SELECT * FROM dim_cust WHERE id = $1', [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      await uploads.removeRequestFiles(req);
      return res.status(404).json({ message: 'Customer tidak ditemukan.' });
    }

    const updatedDocuments = { ...before.documents, ...documents };

    await pool.query(`
      UPDATE dim_cust SET
        name = $1,
        email = $2,
        whatsapp = $3,
        address = $4,
        identity_type = $5,
        company_address = $6,
        documents = $7,
        updated_by = $8,
        updated_at = NOW()
      WHERE id = $9
    `, [
      name,
      email,
      whatsapp,
      address,
      identity_type,
      company_address,
      JSON.stringify(updatedDocuments),
      who.username,
      id
    ]);
    saved = true;

    const replaced = Object.keys(documents)
      .map(key => before.documents?.[key])
      .filter(oldName => oldName && !Object.values(documents).includes(oldName));
    await Promise.all(replaced.map(uploads.deleteFileIfExists));

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'customer',
      'UPDATE',
      JSON.stringify({ before, after: { name, email, whatsapp, address, identity_type, company_address, documents: updatedDocuments }, updated_by: who.username }),
      who.id,
      'Customer Database'
    ]);

    res.json({ message: 'Data customer berhasil diperbarui.' });
  } catch (err) {
    console.error('ERROR PUT /api/customer/:id', err);
    if (!saved) await uploads.removeRequestFiles(req);
    res.status(500).json({ message: 'Gagal mengupdate customer.' });
  }
});

// GET /api/customer/:id
app.get('/api/customer/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM dim_cust WHERE id = $1 AND deleted = false',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer tidak ditemukan.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching customer by ID:', err);
    res.status(500).json({ message: 'Gagal mengambil data customer.' });
  }
});

// GET /api/customer/history/:id
app.get('/api/customer/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, offset } = parsePaging(req.query);

    const result = await pool.query(`
      SELECT * FROM history_log
      WHERE log_id = $1 AND entity = 'customer'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const totalResult = await pool.query(`
      SELECT COUNT(*) FROM history_log
      WHERE log_id = $1 AND entity = 'customer'
    `, [id]);

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      history: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('Error fetching customer history:', err);
    res.status(500).json({ message: 'Gagal ambil log histori.' });
  }
});

// PUT /api/customer/delete/:id
app.put('/api/customer/delete/:id', async (req, res) => {
  const who = actor(req);
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const beforeResult = await pool.query('SELECT * FROM dim_cust WHERE id = $1', [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Customer tidak ditemukan.' });
    }

    await pool.query(`
      UPDATE dim_cust
      SET deleted = true, delete_reason = $1, updated_at = NOW(), updated_by = $2
      WHERE id = $3
    `, [reason, who.username, id]);

    await pool.query(`
      INSERT INTO history_log (log_id, entity, action, changes, user_id, page)
      VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'customer',
      'DELETE',
      JSON.stringify({
        before: {
          name: before.name,
          email: before.email,
          whatsapp: before.whatsapp,
          address: before.address,
          identity_type: before.identity_type,
        },
        after: {
          reason: reason
        },
        deleted_by: `Dihapus oleh ${who.username}`
      }),
      who.id,
      'Customer Database'
    ]);

    res.json({ message: 'Data customer berhasil dihapus (soft delete).' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ message: 'Gagal menghapus data customer.' });
  }
});

async function getAllBanks() {
  const result = await pool.query(`
    SELECT bank_name, logo_url, account_number, account_holder_name
    FROM dim_bank
  `);

  return result.rows.map(row => ({
    logoUrl: row.logo_url,
    bankName: row.bank_name,
    accountNumber: row.account_number,
    accountHolder: row.account_holder_name
  }));
}

// Single recipient only; the pattern rejects lists and display-name syntax.
const EMAIL_RE = /^[^\s@,;<>"()]+@[^\s@,;<>"()]+\.[^\s@,;<>"()]+$/;
const TERMS_PDF = path.join(__dirname, 'public', 'terms_and_conditions.pdf');

// Column names are fixed here and never come from the request.
const EMAIL_KINDS = {
  invoice: {
    logColumn: 'invoice_logs',
    throttled: 'Invoice baru saja dikirim. Coba lagi setelah 10 menit.',
    sent: 'Invoice terkirim.',
  },
  receipt: {
    logColumn: 'receipt_logs',
    throttled: 'Bukti pembayaran untuk transaksi ini baru saja dikirim. Coba lagi setelah 10 menit.',
    sent: 'Receipt terkirim.',
  },
};

async function resolveRecipient(row) {
  let email = typeof row.email === 'string' ? row.email.trim() : '';
  if (!email && row.customer_id) {
    const result = await pool.query('select email from dim_cust where id = $1 and deleted = false', [row.customer_id]);
    email = (result.rows[0]?.email || '').trim();
  }
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

async function sendTransactionEmail(kind, req, res) {
  const cfg = EMAIL_KINDS[kind];
  const transactionId = req.body?.transaction_id;
  if (typeof transactionId !== 'string' || !UUID_RE.test(transactionId)) {
    return res.status(400).json({ message: 'transaction_id tidak valid.' });
  }

  try {
    const result = await pool.query(`
      select id, booking_code, customer_id, email, name, car_type,
             to_char(start_date, 'YYYY-MM-DD') as start_date, start_time,
             to_char(end_date, 'YYYY-MM-DD') as end_date,
             rental_duration, range_rent, needs_trip, needs_driver, needs_delivery, needs_pickup,
             rental_cost, discount, deposit, trip_fee, driver_fee, delivery_fee, pickup_fee,
             grand_total, lunas, deleted
        from fact_transaction
       where id = $1
    `, [transactionId]);
    const row = result.rows[0];
    if (!row || row.deleted) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }

    const to = await resolveRecipient(row);
    if (!to) {
      return res.status(422).json({ message: 'Email customer belum ada atau tidak valid.' });
    }

    if (row.rental_cost === null) {
      return res.status(422).json({ message: 'Rincian biaya transaksi belum lengkap.' });
    }
    let totals;
    try {
      totals = computeTotals(row);
    } catch (err) {
      console.error(`Angka transaksi ${row.id} tidak valid:`, err.message);
      return res.status(422).json({ message: 'Rincian biaya transaksi belum lengkap.' });
    }
    if (totals.grand_total !== Number(row.grand_total)) {
      console.error(`Total transaksi ${row.id} tidak konsisten: hitung ${totals.grand_total}, tersimpan ${row.grand_total}`);
      return res.status(422).json({ message: 'Total transaksi tidak konsisten.' });
    }

    if (kind === 'receipt' && row.lunas !== true) {
      return res.status(409).json({ message: 'Receipt hanya untuk transaksi yang sudah lunas.' });
    }

    const webConfig = await loadWebConfig();

    const templateData = {
      bookingCode: row.booking_code,
      customerName: row.name,
      carType: row.car_type,
      startDate: row.start_date,
      startTime: row.start_time,
      endDate: row.end_date,
      needs: {
        trip: row.needs_trip === true,
        driver: row.needs_driver === true,
        delivery: row.needs_delivery === true,
        pickup: row.needs_pickup === true,
      },
      totals,
      logoUrl: webConfig.logo,
      adminWhatsapp: ADMIN_WHATSAPP,
    };

    const bookingCode = safeSubject(row.booking_code);
    let subject;
    let html;
    let text;
    const attachments = [];
    if (kind === 'invoice') {
      subject = `Konfirmasi Booking ${bookingCode} - Andi Rental Mobil`;
      html = generateInvoiceEmail({ ...templateData, bankList: await getAllBanks() });
      if (fs.existsSync(TERMS_PDF)) {
        attachments.push({
          filename: 'Syarat-dan-Ketentuan-Andi-Rental-Mobil.pdf',
          path: TERMS_PDF,
          contentType: 'application/pdf'
        });
      } else {
        console.warn('Lampiran syarat dan ketentuan tidak ditemukan, invoice dikirim tanpa lampiran.');
      }
    } else {
      subject = `Bukti pembayaran lunas untuk booking ${bookingCode}`;
      const receiptData = {
        ...templateData,
        issuedAt: new Date(),
        signatureUrl: webConfig.signature,
        signatory: signatoryFrom(webConfig, SIGNATORY),
      };
      html = generateReceiptEmail(receiptData);
      text = generateReceiptText(receiptData);
    }

    // Claim the send slot atomically so a double click cannot send twice.
    const claimedAt = new Date().toISOString();
    const claim = await pool.query(`
      update fact_transaction
         set ${cfg.logColumn} = ${cfg.logColumn} || jsonb_build_array($2::text)
       where id = $1
         and deleted = false
         and (jsonb_array_length(${cfg.logColumn}) = 0
              or (${cfg.logColumn} ->> -1)::timestamptz <= now() - interval '10 minutes')
      returning id
    `, [row.id, claimedAt]);
    if (claim.rowCount === 0) {
      return res.status(429).json({ message: cfg.throttled });
    }

    let delivery;
    try {
      delivery = await deliverEmail({ kind, transactionId: row.id, to, subject, html, text, attachments });
    } catch (err) {
      console.error(`Gagal mengirim ${kind} untuk transaksi ${row.id}:`, err.message);
      await pool.query(`
        update fact_transaction
           set ${cfg.logColumn} = ${cfg.logColumn} - (jsonb_array_length(${cfg.logColumn}) - 1)
         where id = $1 and ${cfg.logColumn} ->> -1 = $2
      `, [row.id, claimedAt]);
      return res.status(500).json({ message: 'Email gagal dikirim.' });
    }

    return res.status(200).json({ message: cfg.sent, dry_run: delivery.dryRun });
  } catch (err) {
    console.error(`ERROR kirim ${kind}:`, err);
    return res.status(500).json({ message: 'Email gagal dikirim.' });
  }
}

app.post('/api/send-confirmation-email', (req, res) => sendTransactionEmail('invoice', req, res));
app.post('/api/send-receipt-email', (req, res) => sendTransactionEmail('receipt', req, res));

// Never select dim_user.password into anything that reaches history_log or a response.
const EMPLOYEE_LOG_COLUMNS = 'id, username, full_name, level, created_at';

// POST /api/employees
app.post('/api/employees', requireRole(...MANAGERS), async (req, res) => {
  try {
    const who = actor(req);
    const { username, full_name, level, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ message: 'Username dan password wajib diisi.' });
    }
    if (full_name !== undefined && full_name !== null && typeof full_name !== 'string') {
      return res.status(400).json({ message: 'Nama lengkap tidak valid.' });
    }

    const normalizedLevel = typeof level === 'string' ? level.toLowerCase() : undefined;
    if (!ASSIGNABLE_LEVELS.includes(normalizedLevel)) {
      return res.status(400).json({ message: 'Level tidak valid' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await pool.query(
      'INSERT INTO dim_user (username, full_name, level, password) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, level',
      [username, full_name, normalizedLevel, hashedPassword]
    );

    const insertedUser = result.rows[0];

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      insertedUser.id,
      'employee',
      'CREATE',
      JSON.stringify({
        after: {
          username: insertedUser.username,
          full_name: insertedUser.full_name,
          level: insertedUser.level
        },
        before: null
      }),
      who.id,
      'Manajemen Karyawan'
    ]);

    res.status(201).json({ message: 'Data karyawan berhasil ditambahkan!' });
  } catch (error) {
    console.error('Error adding employee:', error);

    if (error.code === '23505') {
      return res.status(409).json({ message: 'Username sudah digunakan. Gunakan username lain.' });
    }
    res.status(500).json({ message: 'Gagal menambahkan data karyawan.' });
  }
});

// GET /api/employees
app.get('/api/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, full_name, level, created_at FROM dim_user ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/employees/:id
app.put('/api/employees/:id', requireRole(...MANAGERS), async (req, res) => {
  const who = actor(req);
  const { id } = req.params;
  const { full_name, level, password } = req.body || {};

  const levelGiven = level !== undefined && level !== null && level !== '';
  if (levelGiven && typeof level !== 'string') {
    return res.status(400).json({ message: 'Level tidak valid' });
  }
  // bcrypt.hash throws on a non-string and pg would store an array as '{...}' text.
  if ((full_name && typeof full_name !== 'string') || (password && typeof password !== 'string')) {
    return res.status(400).json({ message: 'Data karyawan tidak valid.' });
  }

  try {
    const beforeResult = await pool.query(`select ${EMPLOYEE_LOG_COLUMNS} from dim_user where id = $1`, [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }

    // The edit form always resends the current level, so an unchanged one (even superadmin) is not a level change.
    const requested = levelGiven ? level.toLowerCase() : undefined;
    const normalizedLevel = requested !== undefined && requested !== before.level ? requested : undefined;
    if (normalizedLevel !== undefined && !ASSIGNABLE_LEVELS.includes(normalizedLevel)) {
      return res.status(400).json({ message: 'Level tidak valid' });
    }

    const denied = employeeChangeDenied(who, before, { level: normalizedLevel });
    if (denied) return res.status(403).json({ message: denied });

    const fields = [];
    const values = [];
    let index = 1;

    if (full_name) {
      fields.push(`full_name = $${index++}`);
      values.push(full_name);
    }

    if (normalizedLevel) {
      fields.push(`level = $${index++}`);
      values.push(normalizedLevel);
    }

    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      fields.push(`password = $${index++}`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'Tidak ada field yang diupdate.' });
    }

    values.push(id);

    const updateQuery = `
      UPDATE dim_user
      SET ${fields.join(', ')}
      WHERE id = $${index}
    `;

    await pool.query(updateQuery, values);
    const afterResult = await pool.query(`select ${EMPLOYEE_LOG_COLUMNS} from dim_user where id = $1`, [id]);

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'employee',
      'UPDATE',
      JSON.stringify({
        before,
        after: { ...afterResult.rows[0], updated_by: who.username },
        reason: password ? 'Reset password' : 'Edit data',
      }),
      who.id,
      'Manajemen Karyawan'
    ]);

    res.json({ message: 'Data karyawan berhasil diupdate!' });
  } catch (error) {
    console.error('Error updating employee:', error);
    res.status(500).json({ message: 'Gagal mengupdate data karyawan.' });
  }
});

// DELETE /api/employees/:id
app.delete('/api/employees/:id', requireRole(...MANAGERS), async (req, res) => {
  const who = actor(req);
  const { id } = req.params;

  try {
    const result = await pool.query(`select ${EMPLOYEE_LOG_COLUMNS} from dim_user where id = $1`, [id]);
    const before = result.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Karyawan tidak ditemukan.' });
    }

    const denied = employeeChangeDenied(who, before, { isDelete: true });
    if (denied) return res.status(403).json({ message: denied });

    await pool.query('DELETE FROM dim_user WHERE id = $1', [id]);

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'employee',
      'DELETE',
      JSON.stringify({ before, reason: `Dihapus oleh ${who.username}` }),
      who.id,
      'Manajemen Karyawan'
    ]);

    res.json({ message: 'Data karyawan berhasil dihapus!' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ message: 'Gagal menghapus data karyawan.' });
  }
});

// GET /api/history-logs
app.get('/api/history-logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        h.id,
        h.log_id,
        h.entity,
        h.action,
        h.changes,
        h.page,
        h.created_at,
        h.user_id,
        u.username
      FROM history_log h
      LEFT JOIN dim_user u ON h.user_id = u.id::text
      ORDER BY h.created_at DESC
    `);
    res.json(result.rows.map((row) => ({ ...row, changes: redactLogChanges(row.changes) })));
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ message: 'Gagal mengambil log aktifitas.' });
  }
});

app.get('/api/transaction', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM fact_transaction WHERE deleted = false OR deleted IS NULL ORDER BY updated_at DESC`);

    const transactions = result.rows.map(row => ({
      ...row,
      deposit_payment_url: row.deposit_payment?.filename || null,
      down_payment_url: row.down_payment?.filename || null,
      full_payment_url: row.full_payment?.filename || null,
    }));

    res.json(transactions);
  } catch (err) {
    console.error('Error GET /api/transaction:', err);
    res.status(500).json({ message: 'Gagal ambil data transaksi' });
  }
});

// PUT /api/transaction/upload-payment/:id
app.put('/api/transaction/upload-payment/:id', uploads.uploadPayment, async (req, res) => {
  const who = actor(req);
  const { id } = req.params;
  const { isLunas } = req.body;

  const depositFile = req.files?.deposit?.[0];
  const dpFile = req.files?.dp?.[0];
  const fullFile = req.files?.full?.[0];
  const lunas = isLunas === 'true';

  let saved = false;
  try {
    const beforeResult = await pool.query(
      `SELECT * FROM fact_transaction WHERE id = $1 AND deleted = false`,
      [id]
    );
    const before = beforeResult.rows[0];

    if (!before) {
      await uploads.removeRequestFiles(req);
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }

    const slots = [
      { file: depositFile, deleteFlag: req.body.deleteDeposit === 'true', old: before.deposit_payment },
      { file: dpFile, deleteFlag: req.body.deleteDp === 'true', old: before.down_payment },
      { file: fullFile, deleteFlag: req.body.deleteFull === 'true', old: before.full_payment },
    ];
    const [depositData, dpData, fullData] = slots.map(({ file, deleteFlag, old }) => {
      if (deleteFlag) return null;
      if (file) return { filename: file.filename, mimetype: file.mimetype };
      return old;
    });

    const result = await pool.query(`
      UPDATE fact_transaction
      SET deposit_payment = $1,
          down_payment = $2,
          full_payment = $3,
          lunas = $4,
          updated_by = $5,
          updated_at = NOW()
      WHERE id = $6 AND deleted = false
      RETURNING *
    `, [
      depositData,
      dpData,
      fullData,
      lunas,
      who.username,
      id
    ]);
    // Soft-deleted between the read and this update.
    if (result.rowCount === 0) {
      await uploads.removeRequestFiles(req);
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }
    saved = true;

    // Old proofs go only after the row points at the new ones.
    const stale = slots
      .filter(({ file, deleteFlag, old }) => (file || deleteFlag) && old?.filename)
      .map(({ old }) => old.filename);
    await Promise.all(stale.map(uploads.deleteFileIfExists));

    const after = result.rows[0];

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'transaction',
      'UPDATE',
      JSON.stringify({ before, after, reason: `Upload pembayaran oleh ${who.username}` }),
      who.id,
      'Upload Pembayaran Manual'
    ]);

    res.json({ message: 'Upload bukti pembayaran berhasil' });
  } catch (err) {
    console.error('ERROR PUT /api/transaction/upload-payment/:id', err);
    if (!saved) await uploads.removeRequestFiles(req);
    res.status(500).json({ message: 'Gagal upload bukti pembayaran.' });
  }
});

// GET /api/transaction/history/:id
app.get('/api/transaction/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, offset } = parsePaging(req.query);

    const result = await pool.query(`
      SELECT * FROM history_log
      WHERE log_id = $1 AND entity = 'transaction'
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const totalResult = await pool.query(`
      SELECT COUNT(*) FROM history_log
      WHERE log_id = $1 AND entity = 'transaction'
    `, [id]);

    const total = parseInt(totalResult.rows[0].count);

    res.json({
      history: result.rows,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
  } catch (err) {
    console.error('Error fetching transaction history:', err);
    res.status(500).json({ message: 'Gagal ambil log histori transaksi.' });
  }
});

// PUT /api/transaction/delete/:id
app.put('/api/transaction/delete/:id', async (req, res) => {
  const who = actor(req);
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const beforeResult = await pool.query(`SELECT * FROM fact_transaction WHERE id = $1`, [id]);
    const before = beforeResult.rows[0];

    if (!before) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan.' });
    }

    await pool.query(`
      UPDATE fact_transaction
      SET deleted = true, delete_reason = $1, updated_at = NOW(), updated_by = $2
      WHERE id = $3
    `, [reason, who.username, id]);

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, changes, user_id, page
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    `, [
      id,
      'transaction',
      'DELETE',
      JSON.stringify({ reason, before, deleted_by: `Dihapus oleh ${who.username}` }),
      who.id,
      'Data Transaksi'
    ]);

    res.json({ message: 'Transaksi berhasil dihapus.' });
  } catch (err) {
    console.error('Error DELETE /api/transaction/delete/:id', err);
    res.status(500).json({ message: 'Gagal menghapus transaksi.' });
  }
});

// GET /api/transaction/check-booking-code/:code
app.get('/api/transaction/check-booking-code/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await pool.query(
      'SELECT COUNT(*) FROM fact_transaction WHERE booking_code = $1',
      [code]
    );
    const count = parseInt(result.rows[0].count, 10);
    res.json({ exists: count > 0 });
  } catch (err) {
    console.error('Error checking booking code:', err);
    res.status(500).json({ message: 'Gagal mengecek booking code.' });
  }
});

// POST /api/fact_transaction (reorder): new transaction for an existing customer, no dim_cust write.
app.post('/api/fact_transaction', async (req, res) => {
  const who = actor(req);
  const body = req.body || {};
  const parsed = parseBookingBody(body);
  const data = parsed.data;
  const invalid = parsed.invalid.filter((key) => !CUSTOMER_FIELDS.includes(key));
  const customerId = bodyText(body.customer_id);
  if (!UUID_RE.test(customerId)) invalid.push('customer_id');
  if (invalid.length > 0) {
    return res.status(400).json({ message: 'Data reorder belum lengkap atau tidak valid.', fields: invalid });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('begin');

    // FOR SHARE holds off a concurrent soft delete of this customer until the reorder commits.
    const customer = await client.query(
      `select id, email, name, whatsapp, address, identity_type, company_address
         from dim_cust where id = $1 and deleted = false for share`,
      [customerId]
    );
    if (customer.rowCount === 0) {
      await rollbackQuietly(client);
      return res.status(404).json({ message: 'Customer tidak ditemukan.' });
    }
    for (const key of CUSTOMER_FIELDS) data[key] = customer.rows[0][key];

    const transaction = await withBookingCode(client, (code) => {
      data.booking_code = code;
      return insertTransaction(client, data, customerId, who);
    });

    await client.query(`
      insert into history_log (log_id, entity, action, changes, user_id, page)
      values ($1, 'transaction', 'CREATE', $2::jsonb, $3, 'Reorder Customer')
    `, [
      transaction.id,
      JSON.stringify({ after: transaction, created_by: who.username }),
      who.id,
    ]);

    await client.query('commit');
    return res.status(201).json(transaction);
  } catch (err) {
    if (client) await rollbackQuietly(client);
    return sendBookingError(err, res, 'reorder');
  } finally {
    if (client) client.release();
  }
});

// GET /api/loyalty-customers
app.get('/api/loyalty-customers', async (req, res) => {
  try {
    const result = await pool.query(LOYALTY_SQL);
    res.json(result.rows);
  } catch (err) {
    console.error('Gagal ambil loyalty customer:', err);
    res.status(500).json({ message: 'Gagal mengambil data loyalty customer.' });
  }
});

// GET /api/bank-accounts
app.get('/api/bank-accounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dim_bank ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching bank accounts:', err);
    res.status(500).json({ message: 'Gagal ambil data bank.' });
  }
});

// POST /api/bank-accounts
app.post('/api/bank-accounts', requireRole(...MANAGERS), async (req, res) => {
  const who = actor(req);
  const { bankName, logoUrl, accountNumber, accountHolderName } = req.body;

  try {
    const insertResult = await pool.query(
      `INSERT INTO dim_bank (
        id, bank_name, logo_url, account_number, account_holder_name, created_at, created_by, updated_at, updated_by
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, CURRENT_TIMESTAMP, $5, CURRENT_TIMESTAMP, $6
      ) RETURNING *`,
      [bankName, logoUrl, accountNumber, accountHolderName, who.username, who.username]
    );

    const inserted = insertResult.rows[0];

    await pool.query(
      `INSERT INTO history_log (
        log_id, entity, action, page, changes, user_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
      )`,
      [
        'bank_account',
        'CREATE',
        'Bank Account Settings',
        JSON.stringify({ after: inserted }),
        who.id
      ]
    );

    res.status(201).json(inserted);
  } catch (err) {
    console.error('Error adding bank account:', err);
    res.status(500).json({ message: 'Gagal menambahkan rekening.' });
  }
});

// PUT /api/bank-accounts/:id
app.put('/api/bank-accounts/:id', requireRole(...MANAGERS), async (req, res) => {
  const who = actor(req);
  const { id } = req.params;
  const {
    bankName,
    logoUrl,
    accountNumber,
    accountHolderName
  } = req.body;

  try {
    const { rows: beforeRows } = await pool.query('SELECT * FROM dim_bank WHERE id = $1', [id]);
    const before = beforeRows[0];

    if (!before) {
      return res.status(404).json({ message: 'Rekening tidak ditemukan.' });
    }

    await pool.query(
      `UPDATE dim_bank SET
        bank_name = $1,
        logo_url = $2,
        account_number = $3,
        account_holder_name = $4,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = $5
      WHERE id = $6`,
      [bankName, logoUrl, accountNumber, accountHolderName, who.username, id]
    );

    await pool.query(
      `INSERT INTO history_log (
        log_id, entity, action, page, changes, user_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
      )`,
      [
        'bank_account',
        'UPDATE',
        'Bank Account Settings',
        JSON.stringify({ before, after: { bankName, logoUrl, accountNumber, accountHolderName, updated_by: who.username } }),
        who.id
      ]
    );

    res.json({ message: 'Rekening berhasil diperbarui.' });
  } catch (err) {
    console.error('Error updating bank account:', err);
    res.status(500).json({ message: 'Gagal update rekening.' });
  }
});

// POST /api/bank-accounts/delete/:id
app.post('/api/bank-accounts/delete/:id', requireRole(...MANAGERS), async (req, res) => {
  const who = actor(req);
  const { id } = req.params;

  try {
    const { rows: beforeRows } = await pool.query('SELECT * FROM dim_bank WHERE id = $1', [id]);

    if (beforeRows.length === 0) {
      return res.status(404).json({ message: 'Rekening tidak ditemukan.' });
    }

    const before = beforeRows[0];

    await pool.query('DELETE FROM dim_bank WHERE id = $1', [id]);

    await pool.query(`
      INSERT INTO history_log (
        log_id, entity, action, page, changes, user_id, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
      )
    `, [
      'bank_account',
      'DELETE',
      'Bank Account Settings',
      JSON.stringify({ before }),
      who.id
    ]);

    res.json({ message: 'Rekening berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting bank account:', err);
    res.status(500).json({ message: 'Gagal hapus rekening.' });
  }
});

// GET /api/loyalty-settings
app.get('/api/loyalty-settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM dim_loyalty_poin ORDER BY created_at DESC LIMIT 1');

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({
        daily_point: 1,
        monthly_point: 25,
        point_value: 2000,
        min_exchange_point: 25
      });
    }
  } catch (err) {
    console.error('Error GET /api/loyalty-settings:', err);
    res.status(500).json({ message: 'Gagal mengambil pengaturan loyalty.' });
  }
});

// POST /api/loyalty-settings
app.post('/api/loyalty-settings', requireRole(...MANAGERS), async (req, res) => {
  const who = actor(req);
  try {
    const {
      daily_point,
      monthly_point,
      point_value,
      min_exchange_point
    } = req.body;

    const { rows: existing } = await pool.query(
      'SELECT * FROM dim_loyalty_poin ORDER BY created_at DESC LIMIT 1'
    );

    if (existing.length > 0) {
      await pool.query(`
        UPDATE dim_loyalty_poin
        SET
          daily_point = $1,
          monthly_point = $2,
          point_value = $3,
          min_exchange_point = $4,
          updated_by = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [
        daily_point,
        monthly_point,
        point_value,
        min_exchange_point,
        who.username,
        existing[0].id
      ]);

      await pool.query(`
        INSERT INTO history_log (
          log_id, entity, action, page, changes, user_id, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
        )
      `, [
        'loyalty_poin',
        'UPDATE',
        'Loyalty Settings',
        JSON.stringify({
          before: existing[0],
          after: {
            daily_point,
            monthly_point,
            point_value,
            min_exchange_point,
            updated_by: who.username
          }
        }),
        who.id
      ]);
    } else {
      await pool.query(`
        INSERT INTO dim_loyalty_poin (
          id, daily_point, monthly_point, point_value, min_exchange_point,
          created_by, created_at, updated_by, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP
        )
      `, [
        daily_point,
        monthly_point,
        point_value,
        min_exchange_point,
        who.username,
        who.username
      ]);

      await pool.query(`
        INSERT INTO history_log (
          log_id, entity, action, page, changes, user_id, created_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4::jsonb, $5::uuid, CURRENT_TIMESTAMP
        )
      `, [
        'loyalty_poin',
        'CREATE',
        'Loyalty Settings',
        JSON.stringify({
          before: null,
          after: {
            daily_point,
            monthly_point,
            point_value,
            min_exchange_point,
            created_by: who.username
          }
        }),
        who.id
      ]);
    }

    res.json({ message: 'Loyalty settings saved successfully.' });
  } catch (error) {
    console.error('POST /api/loyalty-settings ERROR:', error);
    res.status(500).json({ message: 'Gagal menyimpan pengaturan loyalty.' });
  }
});

const WEB_CONFIG_DESCRIPTIONS = WEB_CONFIG_FIELDS.map((f) => f.description);

const WEB_CONFIG_COLUMNS = 'id, description, url_image, value_text, created_by, updated_by, created_at, updated_at';

async function loadWebConfig(db = pool) {
  const { rows } = await db.query(
    'select description, url_image, value_text from dim_web_config where lower(description) = any($1::text[])',
    [WEB_CONFIG_DESCRIPTIONS.map((d) => d.toLowerCase())]
  );
  return rowsToConfig(rows);
}

// GET /api/web-config: every fixed key, null when unset (the UI shows the default instead).
app.get('/api/web-config', async (req, res) => {
  try {
    res.json(await loadWebConfig());
  } catch (err) {
    console.error('Error GET /api/web-config:', err);
    res.status(500).json({ message: 'Gagal mengambil pengaturan web.' });
  }
});

// PUT /api/web-config: only the keys sent are touched. Empty or null removes the row,
// which puts that key back on its default.
app.put('/api/web-config', requireRole(...MANAGERS), async (req, res) => {
  const who = actor(req);
  const parsed = parseWebConfigInput(req.body);
  if (parsed.error) return res.status(400).json({ message: parsed.error });

  let client;
  try {
    client = await pool.connect();
    await client.query('begin');

    let changed = 0;
    for (const [key, value] of Object.entries(parsed.values)) {
      const field = FIELD_BY_KEY.get(key);
      const column = field.type === 'url' ? 'url_image' : 'value_text';
      const { rows: existingRows } = await client.query(
        `select ${WEB_CONFIG_COLUMNS} from dim_web_config where lower(description) = lower($1) for update`,
        [field.description]
      );
      const existing = existingRows[0] || null;

      let action = null;
      let after = null;
      if (value === null) {
        if (!existing) continue;
        await client.query('delete from dim_web_config where lower(description) = lower($1)', [field.description]);
        action = 'DELETE';
      } else if (existing) {
        if (existing[column] === value) continue;
        const { rows } = await client.query(
          `update dim_web_config set ${column} = $1, updated_by = $2, updated_at = now() where id = $3 returning ${WEB_CONFIG_COLUMNS}`,
          [value, who.username, existing.id]
        );
        after = rows[0];
        action = 'UPDATE';
      } else {
        const { rows } = await client.query(
          `insert into dim_web_config (description, ${column}, created_by, updated_by, created_at, updated_at)
           values ($1, $2, $3, $3, now(), now()) returning ${WEB_CONFIG_COLUMNS}`,
          [field.description, value, who.username]
        );
        after = rows[0];
        action = 'CREATE';
      }

      await client.query(`
        insert into history_log (log_id, entity, action, changes, user_id, page)
        values ($1, 'web_config', $2, $3::jsonb, $4, 'Pengaturan Web')
      `, [(after || existing).id, action, JSON.stringify({ before: existing, after }), who.id]);
      changed += 1;
    }

    await client.query('commit');
    return res.json({ changed, config: await loadWebConfig() });
  } catch (err) {
    if (client) await rollbackQuietly(client);
    // Two admins inserting the same key at once: dim_web_config_description_key rejects the second.
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Pengaturan ini baru saja diubah admin lain. Muat ulang lalu coba lagi.' });
    }
    console.error('Gagal simpan web config:', err);
    return res.status(500).json({ message: 'Gagal menyimpan pengaturan web.' });
  } finally {
    if (client) client.release();
  }
});

// GET /api/web-config/public (no login: the login page and favicon need it). Logo and favicon only.
app.get('/api/web-config/public', async (req, res) => {
  try {
    res.json(publicConfig(await loadWebConfig()));
  } catch (err) {
    console.error('Gagal ambil web config publik:', err);
    res.status(500).json({ message: 'Gagal mengambil pengaturan web.' });
  }
});

// GET /api/web-config/logo (public). Kept for login tabs opened before /public existed.
app.get('/api/web-config/logo', async (req, res) => {
  try {
    const { logo } = await loadWebConfig();
    if (!logo) return res.status(404).json({ message: 'Logo tidak ditemukan' });
    res.json({ url_image: logo });
  } catch (err) {
    console.error('Gagal ambil logo:', err);
    res.status(500).json({ message: 'Gagal mengambil logo' });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: 'Tidak ditemukan.' });
});

// Never send a stack or raw error text: malformed JSON and bad URI encoding land here.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ message: status === 413 ? 'Data terlalu besar.' : 'Permintaan tidak valid.' });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ message: 'Terjadi kesalahan di server.' });
});

// Express 4 does not catch a rejected async handler; log it instead of letting Node exit.
// The request itself may hang until the client times out, so handlers still need their own try/catch.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
