// Runs against a live backend. Skipped unless TEST_BASE_URL is set. TEST_ORIGIN is an entry
// from the backend's ALLOWED_ORIGINS (defaults to the dev frontend).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL;
const ALLOWED = process.env.TEST_ORIGIN || 'http://localhost:5173';
const skip = !BASE && 'set TEST_BASE_URL';

test('AC-4: GET /api/health is public and reports ok while the DB answers', { skip }, async () => {
  // Arrange
  const url = `${BASE}/api/health`;

  // Act
  const res = await fetch(url);

  // Assert
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('AC-1: a write from a foreign Origin is 403, from an allowed Origin it is not', { skip }, async () => {
  // Arrange
  const post = (origin) => fetch(`${BASE}/api/logout`, { method: 'POST', headers: { origin } });

  // Act
  const foreign = await post('https://evil.example');
  const allowed = await post(ALLOWED);

  // Assert
  assert.equal(foreign.status, 403);
  assert.notEqual(allowed.status, 403);
});
