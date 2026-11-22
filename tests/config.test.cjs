const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAllowedOrigins, parseTrustProxy, parsePort, parseUploadDir, DEV_ORIGINS } = require('../lib/config');

test('ALLOWED_ORIGINS: comma list is trimmed and kept as exact origins', () => {
  // Arrange
  const raw = ' https://rentcar.alyxlabs.tech , http://localhost:5173';

  // Act
  const origins = parseAllowedOrigins(raw, 'production');

  // Assert
  assert.deepEqual(origins, ['https://rentcar.alyxlabs.tech', 'http://localhost:5173']);
});

test('ALLOWED_ORIGINS: empty falls back to localhost in dev and is fatal in production', () => {
  // Arrange
  const empty = ['', undefined, ' , '];

  // Act
  const dev = empty.map((raw) => parseAllowedOrigins(raw, 'development'));

  // Assert
  for (const origins of dev) assert.deepEqual(origins, DEV_ORIGINS);
  for (const raw of empty) assert.throws(() => parseAllowedOrigins(raw, 'production'), /wajib diisi/);
});

test('ALLOWED_ORIGINS: entries that never equal a browser Origin header are rejected', () => {
  // Arrange
  const bad = [
    'https://rentcar.alyxlabs.tech/',
    'https://rentcar.alyxlabs.tech/api',
    'rentcar.alyxlabs.tech',
    'HTTPS://Rentcar.alyxlabs.tech',
    'https://rentcar.alyxlabs.tech:443',
    '*',
  ];

  // Act + Assert
  for (const raw of bad) assert.throws(() => parseAllowedOrigins(raw, 'development'), /tidak valid/, raw);
});

test('TRUST_PROXY: empty or 0 is off, a hop count passes, anything else throws', () => {
  // Arrange + Act
  const off = [undefined, '', '0'].map(parseTrustProxy);
  const one = parseTrustProxy('1');

  // Assert
  assert.deepEqual(off, [0, 0, 0]);
  assert.equal(one, 1);
  for (const raw of ['true', '-1', '1.5', 'loopback']) assert.throws(() => parseTrustProxy(raw), /bilangan bulat/, raw);
});

test('PORT: required and within 1-65535', () => {
  // Arrange + Act
  const port = parsePort('5005');

  // Assert
  assert.equal(port, 5005);
  for (const raw of [undefined, '', '0', '70000', 'abc']) assert.throws(() => parsePort(raw), /PORT wajib/, String(raw));
});

test('UPLOAD_DIR: required in production, defaults to ./uploads in dev, resolved to an absolute path', () => {
  // Arrange
  const path = require('path');
  const devDefault = path.join(__dirname, '..', 'uploads');

  // Act
  const dev = parseUploadDir('', 'development', devDefault);
  const prod = parseUploadDir(' /data/uploads ', 'production', devDefault);

  // Assert
  assert.equal(dev, path.resolve(devDefault));
  assert.equal(prod, path.resolve('/data/uploads'));
  for (const raw of [undefined, '', '  ']) assert.throws(() => parseUploadDir(raw, 'production', devDefault), /UPLOAD_DIR wajib/);
});

test('UPLOAD_DIR: production without it exits 1 with the message, not an EACCES stack', () => {
  // Arrange
  const { spawnSync } = require('child_process');
  const env = { ...process.env, NODE_ENV: 'production', UPLOAD_DIR: '' };

  // Act
  const run = spawnSync(process.execPath, ['-e', "require('./lib/uploads')"], { cwd: require('path').join(__dirname, '..'), env, encoding: 'utf8' });

  // Assert
  assert.equal(run.status, 1);
  assert.match(run.stderr, /UPLOAD_DIR wajib diisi/);
  assert.doesNotMatch(run.stderr, /EACCES|at Object/);
});
