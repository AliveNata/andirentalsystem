// Runs against a live backend and the local DB. Skipped unless the tester sets
// TEST_BASE_URL, QA_ADMIN_USER and QA_ADMIN_PASSWORD (passwords never live in the repo).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const BASE = process.env.TEST_BASE_URL;
const USER = process.env.QA_ADMIN_USER;
const PASSWORD = process.env.QA_ADMIN_PASSWORD;
const skip = !(BASE && USER && PASSWORD) && 'set TEST_BASE_URL, QA_ADMIN_USER, QA_ADMIN_PASSWORD';

const RUN = Date.now().toString(36).toUpperCase();
// Magic bytes are all the upload check reads, so a JPEG header plus filler is enough.
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

let pool;
let uploadDir;
let cookie = '';
let userId = '';

async function api(method, path, body) {
  const headers = { cookie };
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text };
}

function bookingForm(overrides = {}, withFile = true) {
  const fields = {
    email: 'qa-b@example.com',
    name: 'QA-B Penyewa',
    whatsapp: '080000000000',
    address: 'Alamat uji QA-B',
    identity_type: 'single',
    car_type: 'Mobil Uji QA-B',
    rental_duration: 'daily',
    range_rent: '3',
    start_date: '2026-12-01',
    start_time: '09:00',
    end_date: '2026-12-04',
    rental_cost: '1000000',
    deposit: '400000',
    discount: '100000',
    needs_driver: 'true',
    driver_fee: '200000',
    needs_delivery: 'false',
    delivery_fee: '150000',
    grand_total: '999',
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  if (withFile) form.append('ktpFile', new Blob([JPEG], { type: 'image/jpeg' }), 'ktp.jpg');
  return { form, fields };
}

async function snapshot() {
  const r = await pool.query(`
    select (select count(*) from dim_cust)::int as cust,
           (select count(*) from fact_transaction)::int as trx,
           (select count(*) from history_log)::int as logs
  `);
  return { ...r.rows[0], files: fs.readdirSync(uploadDir).length };
}

before(async () => {
  if (skip) return;
  pool = require('../db');
  uploadDir = require('../lib/uploads').UPLOAD_DIR;
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD }),
  });
  assert.equal(res.status, 200, 'login QA gagal');
  cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  userId = (await res.json()).id;
});

after(async () => {
  if (pool) await pool.end();
});

test('AC-K6-1: booking without name is 400 and writes no rows or files', { skip }, async () => {
  // Arrange
  const { form } = bookingForm({ name: undefined, car_type: '' });
  const beforeCounts = await snapshot();

  // Act
  const res = await api('POST', '/api/booking', form);

  // Assert
  assert.equal(res.status, 400);
  assert.deepEqual(res.json.fields.sort(), ['car_type', 'name']);
  assert.deepEqual(await snapshot(), beforeCounts);
});

test('AC-K6-2: DB rejects end_date 2026-02-31, everything rolls back and the file is deleted', { skip }, async () => {
  // Arrange
  // start_date stays before it so the parser's date order check passes and Postgres is the one to reject.
  const { form, fields } = bookingForm({ name: `QA-B Tanggal ${RUN}`, start_date: '2026-02-01', end_date: '2026-02-31' });
  const beforeCounts = await snapshot();

  // Act
  const res = await api('POST', '/api/booking', form);

  // Assert
  assert.equal(res.status, 400);
  assert.deepEqual(res.json, { message: 'Data booking tidak valid.' });
  assert.deepEqual(await snapshot(), beforeCounts);
  const leftover = await pool.query('select 1 from dim_cust where name = $1', [fields.name]);
  assert.equal(leftover.rowCount, 0);
});

test('AC-K6-2: impossible start_time 25:99 rolls back too', { skip }, async () => {
  // Arrange
  const { form } = bookingForm({ start_time: '25:99' });
  const beforeCounts = await snapshot();

  // Act
  const res = await api('POST', '/api/booking', form);

  // Assert
  assert.equal(res.status, 400);
  assert.ok(!/syntax|invalid input|date\/time/i.test(res.text));
  assert.deepEqual(await snapshot(), beforeCounts);
});

test('AC-K6-3, K5-1, K8-1, K8-5: valid booking links customer, recomputes total, logs twice', { skip }, async () => {
  // Arrange
  const { form } = bookingForm();
  const beforeCounts = await snapshot();

  // Act
  const res = await api('POST', '/api/booking', form);

  // Assert
  assert.equal(res.status, 201);
  const { customer, transaction } = res.json;
  assert.equal(transaction.customer_id, customer.id);
  assert.equal(Number(transaction.rental_cost), 1000000);
  assert.equal(Number(transaction.delivery_fee), 0);
  assert.equal(Number(transaction.driver_fee), 200000);
  assert.equal(Number(transaction.grand_total), 1500000);
  assert.equal(customer.booking_code, transaction.booking_code);
  assert.match(transaction.booking_code, /^ARMJ\d{8}[A-Z0-9]{4}$/);
  assert.ok(fs.existsSync(`${uploadDir}/${customer.documents.ktpFile}`));
  const afterCounts = await snapshot();
  assert.deepEqual(
    [afterCounts.cust - beforeCounts.cust, afterCounts.trx - beforeCounts.trx, afterCounts.files - beforeCounts.files],
    [1, 1, 1],
  );
  const logs = await pool.query(
    'select entity, user_id, page from history_log where log_id in ($1, $2) order by entity',
    [customer.id, transaction.id],
  );
  assert.deepEqual(logs.rows, [
    { entity: 'customer', user_id: userId, page: 'Form Booking' },
    { entity: 'transaction', user_id: userId, page: 'Form Booking' },
  ]);
});

test('booking that sends an existing booking code still gets a fresh server code', { skip }, async () => {
  // Arrange
  const first = await api('POST', '/api/booking', bookingForm().form);
  assert.equal(first.status, 201);
  const taken = first.json.transaction.booking_code;
  const { form } = bookingForm({ booking_code: taken });
  const beforeCounts = await snapshot();

  // Act
  const res = await api('POST', '/api/booking', form);

  // Assert
  assert.equal(res.status, 201);
  assert.notEqual(res.json.transaction.booking_code, taken);
  assert.match(res.json.transaction.booking_code, /^ARMJ\d{8}[A-Z0-9]{4}$/);
  const afterCounts = await snapshot();
  assert.deepEqual([afterCounts.cust - beforeCounts.cust, afterCounts.trx - beforeCounts.trx], [1, 1]);
});

test('AC-K8-4: discount above the rental cost is capped at the rental cost', { skip }, async () => {
  // Arrange
  const { form } = bookingForm({ rental_cost: '300000', discount: '500000', deposit: '0', needs_driver: 'false' }, false);

  // Act
  const res = await api('POST', '/api/booking', form);

  // Assert
  assert.equal(res.status, 201);
  assert.equal(Number(res.json.transaction.discount), 300000);
  assert.equal(Number(res.json.transaction.driver_fee), 0);
  assert.equal(Number(res.json.transaction.grand_total), 0);
});

test('AC-K5-2: reorder stores the chosen customer_id and ignores the client total', { skip }, async () => {
  // Arrange
  const seed = await api('POST', '/api/booking', bookingForm({}, false).form);
  const customerId = seed.json.customer.id;
  const body = {
    customer_id: customerId,
    email: 'qa-b@example.com', name: 'QA-B Penyewa', whatsapp: '080000000000', address: 'Alamat uji QA-B',
    identity_type: 'reorder', car_type: 'Mobil Uji QA-B', rental_duration: 'daily', range_rent: 2,
    start_date: '2026-12-10', end_date: '2026-12-12', start_time: '',
    rental_cost: 800000, deposit: 400000, discount: 0,
    needs_pickup: true, pickup_fee: 50000, needs_trip: false, trip_fee: 70000,
    grand_total: 1,
  };

  // Act
  const res = await api('POST', '/api/fact_transaction', body);

  // Assert
  assert.equal(res.status, 201);
  assert.equal(res.json.customer_id, customerId);
  assert.equal(Number(res.json.trip_fee), 0);
  assert.equal(Number(res.json.grand_total), 1250000);
  assert.equal(res.json.start_time, null);
  const log = await pool.query('select user_id, page from history_log where log_id = $1', [res.json.id]);
  assert.deepEqual(log.rows, [{ user_id: userId, page: 'Reorder Customer' }]);
});

test('AC-K6-5: reorder with missing fields or unknown customer writes nothing', { skip }, async () => {
  // Arrange
  const beforeCounts = await snapshot();

  // Act
  const missing = await api('POST', '/api/fact_transaction', { customer_id: 'bukan-uuid', name: '' });
  const unknown = await api('POST', '/api/fact_transaction', {
    customer_id: '00000000-0000-4000-8000-000000000000',
    email: 'qa-b@example.com', name: 'QA-B', whatsapp: '0800', address: 'A',
    identity_type: 'reorder', car_type: 'Mobil', rental_duration: 'daily', range_rent: 1,
    start_date: '2026-12-10', end_date: '2026-12-11', rental_cost: 100000,
  });

  // Assert
  assert.equal(missing.status, 400);
  assert.ok(missing.json.fields.includes('customer_id'));
  assert.ok(missing.json.fields.includes('rental_cost'));
  assert.equal(unknown.status, 404);
  assert.deepEqual(await snapshot(), beforeCounts);
});

test('AC-K5-5 and removed routes answer 404', { skip }, async () => {
  // Act
  const results = await Promise.all([
    api('PUT', '/api/customer/upload-payment/00000000-0000-4000-8000-000000000000'),
    api('POST', '/api/customer', { name: 'x' }),
    api('POST', '/api/transaction', { name: 'x' }),
  ]);

  // Assert
  assert.deepEqual(results.map((r) => r.status), [404, 404, 404]);
});
