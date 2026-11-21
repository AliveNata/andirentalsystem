// T14 regression tests for review findings N1 to N4 and Erza 2. Runs against a live backend
// and the local DB; skipped unless TEST_BASE_URL plus the QA admin and manager logins are set.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const BASE = process.env.TEST_BASE_URL;
const ADMIN = process.env.QA_ADMIN_USER;
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
const MANAGER = process.env.QA_MANAGER_USER;
const MANAGER_PASSWORD = process.env.QA_MANAGER_PASSWORD;
const skip = !(BASE && ADMIN && ADMIN_PASSWORD && MANAGER && MANAGER_PASSWORD)
  && 'set TEST_BASE_URL, QA_ADMIN_USER, QA_ADMIN_PASSWORD, QA_MANAGER_USER, QA_MANAGER_PASSWORD';

const RUN = Date.now().toString(36).toUpperCase();
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

let pool;
let uploadDir;
let admin = '';
let manager = '';
const createdEmployees = [];
const BOOKING_CODE_RE = /^ARMJ\d{8}[A-Z0-9]{4}$/;

async function login(username, password) {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `login ${username} gagal`);
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

async function api(cookie, method, path, body) {
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

function bookingForm(overrides = {}, withFile = false) {
  const fields = {
    email: 'qa-t14-asli@example.com',
    name: 'QA-T14 Penyewa',
    whatsapp: '080000001414',
    address: 'Alamat uji QA-T14',
    identity_type: 'single',
    car_type: 'Mobil Uji QA-T14',
    rental_duration: 'daily',
    range_rent: '2',
    start_date: '2026-12-01',
    end_date: '2026-12-03',
    rental_cost: '800000',
    deposit: '400000',
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, value);
  }
  if (withFile) form.append('ktpFile', new Blob([JPEG], { type: 'image/jpeg' }), 'ktp.jpg');
  return { form, fields };
}

function reorderBody(customerId, overrides = {}) {
  return {
    customer_id: customerId,
    car_type: 'Mobil Uji QA-T14', rental_duration: 'daily', range_rent: 1,
    start_date: '2026-12-10', end_date: '2026-12-11', start_time: '',
    rental_cost: 500000, deposit: 0, discount: 0,
    ...overrides,
  };
}

async function seedCustomer() {
  const res = await api(admin, 'POST', '/api/booking', bookingForm().form);
  assert.equal(res.status, 201);
  return res.json.customer;
}

async function snapshot() {
  const r = await pool.query(`
    select (select count(*) from dim_cust)::int as cust,
           (select count(*) from fact_transaction)::int as trx,
           (select count(*) from dim_user)::int as users
  `);
  return { ...r.rows[0], files: fs.readdirSync(uploadDir).length };
}

before(async () => {
  if (skip) return;
  pool = require('../db');
  uploadDir = require('../lib/uploads').UPLOAD_DIR;
  admin = await login(ADMIN, ADMIN_PASSWORD);
  manager = await login(MANAGER, MANAGER_PASSWORD);
});

after(async () => {
  if (skip) return;
  for (const id of createdEmployees) await api(manager, 'DELETE', `/api/employees/${id}`);
  await pool.end();
});

test('N1: POST /api/employees with non-string level or username is 400 and the process stays up', { skip }, async () => {
  // Arrange
  const base = { username: `qa-t14-n1-${RUN}`, full_name: 'QA T14', password: 'Qa-T14-pw-uji' };
  const bodies = [
    { ...base, level: ['admin'] },
    { ...base, level: { toLowerCase: 1 } },
    { ...base, level: 5 },
    { ...base, level: 'admin', username: ['qa-t14-array'] },
    { ...base, level: 'admin', password: ['x'] },
    { ...base, level: 'admin', full_name: { a: 1 } },
  ];
  const beforeCounts = await snapshot();

  // Act
  const results = [];
  for (const body of bodies) results.push(await api(manager, 'POST', '/api/employees', body));
  const alive = await api(manager, 'GET', '/api/me');

  // Assert
  assert.deepEqual(results.map((r) => r.status), [400, 400, 400, 400, 400, 400]);
  assert.equal(alive.status, 200);
  assert.deepEqual(await snapshot(), beforeCounts);
});

test('N1: PUT /api/employees/:id with a non-string password or full_name is 400', { skip }, async () => {
  // Arrange
  const username = `qa-t14-put-${RUN}`;
  const created = await api(manager, 'POST', '/api/employees', { username, full_name: 'QA T14', level: 'admin', password: 'Qa-T14-pw-uji' });
  assert.equal(created.status, 201);
  const list = await api(manager, 'GET', '/api/employees');
  const target = list.json.find((e) => e.username === username);
  createdEmployees.push(target.id);

  // Act
  const badPassword = await api(manager, 'PUT', `/api/employees/${target.id}`, { password: ['x'] });
  const badName = await api(manager, 'PUT', `/api/employees/${target.id}`, { full_name: ['x'] });
  const alive = await api(manager, 'GET', '/api/me');

  // Assert
  assert.equal(badPassword.status, 400);
  assert.equal(badName.status, 400);
  assert.equal(alive.status, 200);
});

test('N3: reorder stores contact data from dim_cust and ignores the body', { skip }, async () => {
  // Arrange
  const customer = await seedCustomer();
  const body = reorderBody(customer.id, {
    email: 'qa-t14-nyasar@example.com', name: 'Nama Lain', whatsapp: '089999999999',
    address: 'Alamat lain', identity_type: 'corporate', company_address: 'Kantor lain',
  });

  // Act
  const res = await api(admin, 'POST', '/api/fact_transaction', body);
  const withoutContact = await api(admin, 'POST', '/api/fact_transaction', reorderBody(customer.id));

  // Assert
  assert.equal(res.status, 201);
  const stored = await pool.query(
    'select email, name, whatsapp, address, identity_type, company_address from fact_transaction where id = $1',
    [res.json.id],
  );
  assert.deepEqual(stored.rows[0], {
    email: customer.email, name: customer.name, whatsapp: customer.whatsapp,
    address: customer.address, identity_type: customer.identity_type, company_address: customer.company_address,
  });
  assert.equal(withoutContact.status, 201);
  assert.equal(withoutContact.json.email, customer.email);
});

test('N2: booking rejects negative, oversized, non-decimal amounts and bad range or dates', { skip }, async () => {
  // Arrange
  const cases = [
    [{ rental_cost: '-1' }, 'rental_cost'],
    [{ deposit: '-500' }, 'deposit'],
    [{ discount: '10000000001' }, 'discount'],
    [{ deposit: '1e300' }, 'deposit'],
    [{ needs_driver: 'true', driver_fee: '0x10' }, 'driver_fee'],
    [{ pickup_fee: 'Infinity' }, 'pickup_fee'],
    [{ trip_fee: '-1' }, 'trip_fee'],
    [{ delivery_fee: '1e3' }, 'delivery_fee'],
    [{ range_rent: '0' }, 'range_rent'],
    [{ range_rent: '1.5' }, 'range_rent'],
    [{ start_date: '2026-12-05', end_date: '2026-12-04' }, 'end_date'],
  ];
  const beforeCounts = await snapshot();

  // Act
  const results = [];
  for (const [overrides] of cases) results.push(await api(admin, 'POST', '/api/booking', bookingForm(overrides, true).form));

  // Assert
  results.forEach((res, i) => {
    assert.equal(res.status, 400, JSON.stringify(cases[i][0]));
    assert.deepEqual(res.json.fields, [cases[i][1]], JSON.stringify(cases[i][0]));
  });
  assert.deepEqual(await snapshot(), beforeCounts);
});

test('N2: reorder applies the same rules to JSON numbers and accepts the exact ceiling', { skip }, async () => {
  // Arrange
  const customer = await seedCustomer();
  const cases = [
    [{ rental_cost: -5 }, 'rental_cost'],
    [{ deposit: 1e300 }, 'deposit'],
    [{ discount: '0x10' }, 'discount'],
    [{ range_rent: 2.5 }, 'range_rent'],
    [{ range_rent: 0 }, 'range_rent'],
    [{ start_date: '2026-12-11', end_date: '2026-12-10' }, 'end_date'],
  ];
  const beforeCounts = await snapshot();

  // Act
  const results = [];
  for (const [overrides] of cases) results.push(await api(admin, 'POST', '/api/fact_transaction', reorderBody(customer.id, overrides)));
  const afterRejects = await snapshot();
  const ceiling = await api(admin, 'POST', '/api/fact_transaction', reorderBody(customer.id, { rental_cost: 10000000000, start_date: '2026-12-10', end_date: '2026-12-10' }));

  // Assert
  results.forEach((res, i) => {
    assert.equal(res.status, 400, JSON.stringify(cases[i][0]));
    assert.deepEqual(res.json.fields, [cases[i][1]], JSON.stringify(cases[i][0]));
  });
  assert.deepEqual(afterRejects, beforeCounts);
  assert.equal(ceiling.status, 201);
  assert.equal(Number(ceiling.json.grand_total), 10000000000);
});

// With server codes a client cannot replay a code, so concurrent reorders each get their own unique code.
test('N4: concurrent reorders get distinct server codes and never share an active code', { skip }, async () => {
  // Arrange
  const customer = await seedCustomer();
  const body = reorderBody(customer.id);

  // Act
  const results = await Promise.all([
    api(admin, 'POST', '/api/fact_transaction', body),
    api(admin, 'POST', '/api/fact_transaction', body),
  ]);

  // Assert
  assert.deepEqual(results.map((r) => r.status), [201, 201]);
  const codes = results.map((r) => r.json.booking_code);
  for (const c of codes) assert.match(c, BOOKING_CODE_RE);
  assert.notEqual(codes[0], codes[1]);
  const rows = await pool.query(
    'select count(*)::int as n from fact_transaction where booking_code = any($1) and deleted = false',
    [codes],
  );
  assert.equal(rows.rows[0].n, 2);
});

test('N4: reorder sending an active booking code ignores it and gets a fresh one', { skip }, async () => {
  // Arrange
  const seeded = await api(admin, 'POST', '/api/booking', bookingForm().form);
  const taken = seeded.json.transaction.booking_code;
  const body = reorderBody(seeded.json.customer.id, { booking_code: taken });

  // Act
  const res = await api(admin, 'POST', '/api/fact_transaction', body);

  // Assert
  assert.equal(res.status, 201);
  assert.notEqual(res.json.booking_code, taken);
  assert.match(res.json.booking_code, BOOKING_CODE_RE);
});

test('Erza 2: payment upload to a soft-deleted transaction is 404 and the file is removed', { skip }, async () => {
  // Arrange
  const seeded = await api(admin, 'POST', '/api/booking', bookingForm().form);
  const trxId = seeded.json.transaction.id;
  const del = await api(admin, 'PUT', `/api/transaction/delete/${trxId}`, { reason: 'QA-T14 uji hapus' });
  assert.equal(del.status, 200);
  const form = new FormData();
  form.append('isLunas', 'true');
  form.append('full', new Blob([JPEG], { type: 'image/jpeg' }), 'bukti.jpg');
  const beforeCounts = await snapshot();

  // Act
  const res = await api(admin, 'PUT', `/api/transaction/upload-payment/${trxId}`, form);

  // Assert
  assert.equal(res.status, 404);
  assert.deepEqual(res.json, { message: 'Transaksi tidak ditemukan.' });
  assert.deepEqual(await snapshot(), beforeCounts);
  const row = await pool.query('select full_payment, lunas from fact_transaction where id = $1', [trxId]);
  assert.deepEqual(row.rows[0], { full_payment: null, lunas: false });
});
