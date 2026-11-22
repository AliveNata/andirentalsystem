// Server-generated booking codes and GET /api/customer/lookup against a live backend and the local DB.
// Skipped unless TEST_BASE_URL, QA_ADMIN_USER and QA_ADMIN_PASSWORD are set.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { jakartaDateStamp } = require('../lib/bookingCode');

const BASE = process.env.TEST_BASE_URL;
const USER = process.env.QA_ADMIN_USER;
const PASSWORD = process.env.QA_ADMIN_PASSWORD;
const skip = !(BASE && USER && PASSWORD) && 'set TEST_BASE_URL, QA_ADMIN_USER, QA_ADMIN_PASSWORD';

const RUN = Date.now().toString();
const BOOKING_CODE_RE = /^ARMJ\d{8}[A-Z0-9]{4}$/;
// Unique per run so lookup matches only rows this file created.
const EMAIL = `qa-code-${RUN}@example.com`;
const LOCAL_WA = `08${RUN.slice(-10)}`;

let pool;
let cookie = '';
let seeded;

async function api(method, path, body, withCookie = true) {
  const headers = withCookie ? { cookie } : {};
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

function bookingForm(overrides = {}) {
  const fields = {
    email: EMAIL,
    name: `QA-CODE-${RUN} Penyewa`,
    whatsapp: LOCAL_WA,
    address: 'Alamat uji QA-CODE',
    identity_type: 'single',
    car_type: 'Mobil Uji QA-CODE',
    rental_duration: 'daily',
    range_rent: '1',
    start_date: '2026-12-01',
    end_date: '2026-12-02',
    rental_cost: '500000',
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

function lookup(params, withCookie = true) {
  return api('GET', `/api/customer/lookup?${new URLSearchParams(params)}`, undefined, withCookie);
}

before(async () => {
  if (skip) return;
  pool = require('../db');
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD }),
  });
  assert.equal(res.status, 200, 'login QA gagal');
  cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const created = await api('POST', '/api/booking', bookingForm());
  assert.equal(created.status, 201);
  seeded = created.json;
});

after(async () => {
  if (pool) await pool.end();
});

test('booking gets an ARMJ code dated today in WIB, the same on customer and transaction', { skip }, async () => {
  // Arrange
  const today = jakartaDateStamp();

  // Act
  const code = seeded.transaction.booking_code;

  // Assert
  assert.match(code, BOOKING_CODE_RE);
  assert.equal(code.slice(4, 12), today);
  assert.equal(seeded.customer.booking_code, code);
});

test('booking_code from the body is ignored on booking and reorder', { skip }, async () => {
  // Arrange
  const sent = `QA-CODE-${RUN}-CLIENT`;

  // Act
  const booking = await api('POST', '/api/booking', bookingForm({ booking_code: sent, name: `QA-CODE-${RUN} Kedua` }));
  const reorder = await api('POST', '/api/fact_transaction', {
    customer_id: seeded.customer.id, booking_code: sent,
    car_type: 'Mobil Uji QA-CODE', rental_duration: 'daily', range_rent: 1,
    start_date: '2026-12-10', end_date: '2026-12-11', rental_cost: 500000,
  });

  // Assert
  assert.equal(booking.status, 201);
  assert.match(booking.json.transaction.booking_code, BOOKING_CODE_RE);
  assert.equal(reorder.status, 201);
  assert.match(reorder.json.booking_code, BOOKING_CODE_RE);
  const stored = await pool.query('select count(*)::int as n from fact_transaction where booking_code = $1', [sent]);
  assert.equal(stored.rows[0].n, 0);
});

test('lookup matches email regardless of case and surrounding spaces', { skip }, async () => {
  // Act
  const res = await lookup({ email: `  ${EMAIL.toUpperCase()} ` });

  // Assert
  assert.equal(res.status, 200);
  const ids = res.json.matches.map((m) => m.id);
  assert.ok(ids.includes(seeded.customer.id));
});

test('lookup treats whatsapp 0812, 62812 and +62 812 as the same number', { skip }, async () => {
  // Arrange
  const rest = LOCAL_WA.slice(1);
  const variants = [LOCAL_WA, `62${rest}`, `+62 ${rest.slice(0, 3)}-${rest.slice(3)}`];

  // Act
  const results = [];
  for (const whatsapp of variants) results.push(await lookup({ whatsapp }));

  // Assert
  for (const res of results) {
    assert.equal(res.status, 200);
    assert.ok(res.json.matches.some((m) => m.id === seeded.customer.id), JSON.stringify(res.json));
  }
});

test('lookup returns only the contract fields, newest first, at most 5, and skips deleted rows', { skip }, async () => {
  // Arrange
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await api('POST', '/api/booking', bookingForm({ name: `QA-CODE-${RUN} Ulang ${i}` }))).status, 201);
  }
  await pool.query('update dim_cust set deleted = true where id = $1', [seeded.customer.id]);

  // Act
  const res = await lookup({ email: EMAIL, whatsapp: LOCAL_WA });

  // Assert
  assert.equal(res.status, 200);
  assert.equal(res.json.matches.length, 5);
  for (const m of res.json.matches) {
    assert.deepEqual(Object.keys(m).sort(), ['email', 'id', 'identity_type', 'name', 'whatsapp']);
  }
  assert.ok(!res.json.matches.some((m) => m.id === seeded.customer.id));
  assert.equal(res.json.matches[0].name, `QA-CODE-${RUN} Ulang 4`);
});

test('lookup without email and whatsapp is 400', { skip }, async () => {
  // Act
  const none = await lookup({});
  const blank = await lookup({ email: ' ', whatsapp: '' });

  // Assert
  assert.equal(none.status, 400);
  assert.equal(blank.status, 400);
});

test('lookup without a session is 401', { skip }, async () => {
  // Act
  const res = await lookup({ email: EMAIL }, false);

  // Assert
  assert.equal(res.status, 401);
});
