const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sameOriginWrites, employeeChangeDenied, redactLogChanges } = require('../lib/auth');

function run(mw, { method, origin }) {
  const req = { method, get: (name) => (name.toLowerCase() === 'origin' ? origin : undefined) };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let passed = false;
  mw(req, res, () => { passed = true; });
  return { passed, status: res.statusCode };
}

test('writes from a foreign Origin are 403, allowed or missing Origin pass', () => {
  // Arrange
  const mw = sameOriginWrites(['http://localhost:5173']);

  // Act
  const foreign = run(mw, { method: 'POST', origin: 'https://evil.example' });
  const allowed = run(mw, { method: 'DELETE', origin: 'http://localhost:5173' });
  const noOrigin = run(mw, { method: 'PUT', origin: undefined });
  const foreignRead = run(mw, { method: 'GET', origin: 'https://evil.example' });

  // Assert
  assert.deepEqual(foreign, { passed: false, status: 403 });
  assert.equal(allowed.passed, true);
  assert.equal(noOrigin.passed, true);
  assert.equal(foreignRead.passed, true);
});

test('only a superadmin may touch a superadmin account', () => {
  // Arrange
  const target = { id: 'a', level: 'superadmin' };
  const manager = { id: 'b', level: 'manajemen' };
  const superadmin = { id: 'c', level: 'superadmin' };

  // Act
  const byManagerEdit = employeeChangeDenied(manager, target, {});
  const byManagerDelete = employeeChangeDenied(manager, target, { isDelete: true });
  const bySuperadmin = employeeChangeDenied(superadmin, target, { level: 'admin' });

  // Assert
  assert.ok(byManagerEdit);
  assert.ok(byManagerDelete);
  assert.equal(bySuperadmin, null);
});

test('an account cannot change its own level or delete itself, but can edit its name', () => {
  // Arrange
  const me = { id: 'm', level: 'manajemen' };

  // Act
  const demoteSelf = employeeChangeDenied(me, me, { level: 'admin' });
  const sameLevel = employeeChangeDenied(me, me, { level: 'manajemen' });
  const nameOnly = employeeChangeDenied(me, me, {});
  const deleteSelf = employeeChangeDenied(me, me, { isDelete: true });

  // Assert
  assert.ok(demoteSelf);
  assert.equal(sameLevel, null);
  assert.equal(nameOnly, null);
  assert.ok(deleteSelf);
});

test('redactLogChanges drops password from before and after without touching the input', () => {
  // Arrange
  const changes = {
    before: { username: 'x', password: '$2b$10$abcdefghijklmnopqrstuv' },
    after: { username: 'y', password: '$2b$10$zzz' },
    reason: 'Edit data',
  };

  // Act
  const out = redactLogChanges(changes);

  // Assert
  assert.doesNotMatch(JSON.stringify(out), /\$2[aby]\$/);
  assert.deepEqual(out, { before: { username: 'x' }, after: { username: 'y' }, reason: 'Edit data' });
  assert.ok('password' in changes.before);
  assert.equal(redactLogChanges(null), null);
});
