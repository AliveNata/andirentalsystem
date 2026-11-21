// Runs against a live backend. Skipped unless TEST_BASE_URL, QA_MANAGER_USER and
// QA_MANAGER_PASSWORD are set. Creates qa-t10-* accounts and deletes them at the end.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL;
const MANAGER = process.env.QA_MANAGER_USER;
const MANAGER_PASSWORD = process.env.QA_MANAGER_PASSWORD;
const skip = !(BASE && MANAGER && MANAGER_PASSWORD) && 'set TEST_BASE_URL, QA_MANAGER_USER, QA_MANAGER_PASSWORD';

const RUN = Date.now().toString(36);
const TEMP_PASSWORD = `Qa-t10-${RUN}-pw`;
const BCRYPT = /\$2[aby]\$/;
const RANDOM_UUID = '00000000-0000-4000-8000-000000000000';

let manager = { cookie: '', id: '' };
const created = new Map();

async function api(session, method, path, body, headers = {}) {
  const init = { method, headers: { cookie: session.cookie, ...headers } };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text, headers: res.headers };
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `login ${username} gagal`);
  const cookie = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  return { cookie, id: (await res.json()).id };
}

async function createEmployee(suffix, level) {
  const username = `qa-t10-${suffix}-${RUN}`;
  const res = await api(manager, 'POST', '/api/employees', { username, full_name: `QA T10 ${suffix}`, level, password: TEMP_PASSWORD });
  assert.equal(res.status, 201);
  const list = await api(manager, 'GET', '/api/employees');
  const row = list.json.find((e) => e.username === username);
  created.set(row.id, username);
  return { ...row, ...(await login(username, TEMP_PASSWORD)) };
}

before(async () => {
  if (skip) return;
  manager = await login(MANAGER, MANAGER_PASSWORD);
});

after(async () => {
  if (skip) return;
  for (const id of created.keys()) {
    await api(manager, 'DELETE', `/api/employees/${id}`);
  }
});

test('F1: manajemen cannot promote anyone to superadmin', { skip }, async () => {
  // Arrange
  const target = await createEmployee('promote', 'admin');

  // Act
  const res = await api(manager, 'PUT', `/api/employees/${target.id}`, { level: 'superadmin' });
  const list = await api(manager, 'GET', '/api/employees');

  // Assert
  assert.equal(res.status, 400);
  assert.equal(list.json.find((e) => e.id === target.id).level, 'admin');
});

test('F1: an account cannot change its own level but the edit form resending it still works', { skip }, async () => {
  // Arrange
  const self = await createEmployee('self', 'manajemen');

  // Act
  const demote = await api(self, 'PUT', `/api/employees/${self.id}`, { level: 'admin' });
  const formResend = await api(self, 'PUT', `/api/employees/${self.id}`, { full_name: 'QA T10 self edit', level: 'Manajemen' });

  // Assert
  assert.equal(demote.status, 403);
  assert.equal(formResend.status, 200);
});

test('F2: employee edit and delete logs carry no bcrypt hash', { skip }, async () => {
  // Arrange
  const target = await createEmployee('log', 'admin');

  // Act
  const edit = await api(manager, 'PUT', `/api/employees/${target.id}`, { full_name: 'QA T10 log edit', password: `${TEMP_PASSWORD}-2` });
  const del = await api(manager, 'DELETE', `/api/employees/${target.id}`);
  created.delete(target.id);
  const logs = await api(manager, 'GET', '/api/history-logs');

  // Assert
  assert.equal(edit.status, 200);
  assert.equal(del.status, 200);
  assert.equal(logs.status, 200);
  assert.doesNotMatch(logs.text, BCRYPT);
  const mine = logs.json.filter((l) => l.log_id === target.id);
  assert.deepEqual(mine.map((l) => l.action).sort(), ['CREATE', 'DELETE', 'UPDATE']);
});

test('F3: a deleted account gets 401 on its very next request', { skip }, async () => {
  // Arrange
  const victim = await createEmployee('deleted', 'admin');
  assert.equal((await api(victim, 'GET', '/api/employees')).status, 200);

  // Act
  const del = await api(manager, 'DELETE', `/api/employees/${victim.id}`);
  created.delete(victim.id);
  const next = await api(victim, 'GET', '/api/employees');
  const me = await api(victim, 'GET', '/api/me');

  // Assert
  assert.equal(del.status, 200);
  assert.equal(next.status, 401);
  assert.equal(me.status, 401);
});

test('F3: a demoted account loses manager routes without logging out', { skip }, async () => {
  // Arrange
  const demoted = await createEmployee('demoted', 'manajemen');
  assert.equal((await api(demoted, 'PUT', '/api/web-config', {})).status, 400);

  // Act
  const put = await api(manager, 'PUT', `/api/employees/${demoted.id}`, { level: 'admin' });
  const afterDemote = await api(demoted, 'PUT', '/api/web-config', {});
  const me = await api(demoted, 'GET', '/api/me');

  // Assert
  assert.equal(put.status, 200);
  assert.equal(afterDemote.status, 403);
  assert.equal(me.json.user.level, 'admin');
});

test('F4: a write with a foreign Origin is 403, the allowed Origin is not', { skip }, async () => {
  // Act
  const foreign = await api(manager, 'PUT', '/api/web-config', {}, { origin: 'https://evil.example' });
  const allowed = await api(manager, 'PUT', '/api/web-config', {}, { origin: 'http://localhost:5173' });

  // Assert
  assert.equal(foreign.status, 403);
  assert.equal(allowed.status, 400);
});

test('F6: web-config rejects an empty body, unknown keys, non-https urls and long text with 400', { skip }, async () => {
  // Act
  const empty = await api(manager, 'PUT', '/api/web-config', {});
  const unknown = await api(manager, 'PUT', '/api/web-config', { [`qa-t10-${RUN}`]: 'x' });
  const jsUrl = await api(manager, 'PUT', '/api/web-config', { logo: 'javascript:alert(1)' });
  const httpUrl = await api(manager, 'PUT', '/api/web-config', { logo: 'http://a.example/logo.png' });
  const longName = await api(manager, 'PUT', '/api/web-config', { signatoryName: 'x'.repeat(101) });

  // Assert
  assert.deepEqual(
    [empty.status, unknown.status, jsUrl.status, httpUrl.status, longName.status],
    [400, 400, 400, 400, 400],
  );
});

test('web-config/public answers without a session and exposes only logo and favicon', { skip }, async () => {
  // Act
  const res = await api({ cookie: '' }, 'GET', '/api/web-config/public');

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.json).sort(), ['favicon', 'logo']);
});

test('F7: limit=-1 and offset=-5 on history routes fall back instead of 500', { skip }, async () => {
  // Act
  const customer = await api(manager, 'GET', `/api/customer/history/${RANDOM_UUID}?limit=-1&offset=-5`);
  const trx = await api(manager, 'GET', `/api/transaction/history/${RANDOM_UUID}?limit=abc&offset=1e9999`);

  // Assert
  assert.equal(customer.status, 200);
  assert.equal(customer.json.limit, 5);
  assert.equal(customer.json.offset, 0);
  assert.equal(trx.status, 200);
});

test('F7: truncated multipart is 400 and x-powered-by is gone', { skip }, async () => {
  // Arrange
  const boundary = `qa${RUN}`;
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nQA`;

  // Act
  const res = await fetch(`${BASE}/api/customer/${RANDOM_UUID}`, {
    method: 'PUT',
    headers: { cookie: manager.cookie, 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
  });

  // Assert
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('x-powered-by'), null);
});
