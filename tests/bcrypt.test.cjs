// bcrypt 6 must still verify both hash families stored in dim_user:
// $2a$ from pgcrypto crypt() and $2b$ from bcrypt in node.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');

const PASSWORD = 'QA-T14-bcrypt-uji';  // ggignore: test-only fixture
// Made once with psql: select crypt('QA-T14-bcrypt-uji', gen_salt('bf'));  // ggignore
const PGCRYPTO_HASH = '$2a$06$TQQ9ejxIkKJbd1vc1NTUGu/mZDS3rcsb3jiVNYwJBunyC9l313NnW';  // ggignore: hash of the test-only fixture above

const BASE = process.env.TEST_BASE_URL;
const ADMIN = process.env.QA_ADMIN_USER;
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD;
const skipLive = !(BASE && ADMIN && ADMIN_PASSWORD) && 'set TEST_BASE_URL, QA_ADMIN_USER, QA_ADMIN_PASSWORD';

let pool;

after(async () => {
  if (pool) await pool.end();
});

test('installed bcrypt is major version 6', () => {
  // Act
  const { version } = require('bcrypt/package.json');

  // Assert
  assert.match(version, /^6\./);
});

test('bcrypt 6 accepts a stored pgcrypto $2a$ hash and rejects a wrong password', async () => {
  // Act
  const ok = await bcrypt.compare(PASSWORD, PGCRYPTO_HASH);
  const wrong = await bcrypt.compare('salah', PGCRYPTO_HASH);

  // Assert
  assert.equal(ok, true);
  assert.equal(wrong, false);
});

test('bcrypt 6 still writes $2b$ hashes that it can verify', async () => {
  // Arrange
  const hash = await bcrypt.hash(PASSWORD, 10);

  // Act
  const ok = await bcrypt.compare(PASSWORD, hash);

  // Assert
  assert.match(hash, /^\$2b\$10\$/);
  assert.equal(ok, true);
});

test('a fresh pgcrypto crypt() hash from the live DB verifies in bcrypt 6', { skip: skipLive }, async () => {
  // Arrange
  pool = require('../db');
  const { rows } = await pool.query("select crypt($1, gen_salt('bf')) as hash", [PASSWORD]);

  // Act
  const ok = await bcrypt.compare(PASSWORD, rows[0].hash);

  // Assert
  assert.match(rows[0].hash, /^\$2a\$/);
  assert.equal(ok, true);
});

test('qa-admin ($2b$ hash) logs in through the running backend', { skip: skipLive }, async () => {
  // Arrange
  pool = pool || require('../db');
  const stored = await pool.query('select left(password, 4) as prefix from dim_user where username = $1', [ADMIN]);

  // Act
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: ADMIN, password: ADMIN_PASSWORD }),
  });

  // Assert
  assert.equal(stored.rows[0].prefix, '$2b$');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).username, ADMIN);
});
