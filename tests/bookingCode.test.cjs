const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  BOOKING_CODE_RE, MAX_ATTEMPTS, generateBookingCode, jakartaDateStamp, withBookingCode,
} = require('../lib/bookingCode');

function fakeClient() {
  const queries = [];
  return { queries, query: async (sql) => { queries.push(sql); } };
}

function conflict(constraint = 'fact_transaction_booking_code_active_key') {
  return Object.assign(new Error('duplicate key'), { code: '23505', constraint });
}

test('generated code matches ARMJ + 8 digits + 4 uppercase alphanumerics', () => {
  // Arrange
  const now = new Date('2026-11-21T03:00:00Z');

  // Act
  const codes = Array.from({ length: 200 }, () => generateBookingCode(now));

  // Assert
  for (const code of codes) assert.match(code, BOOKING_CODE_RE);
  assert.ok(codes.every((c) => c.startsWith('ARMJ20261121')));
});

test('suffix comes from the injected random source over A-Z0-9', () => {
  // Arrange
  const picks = [10, 35, 0, 25];
  const randomInt = (max) => { assert.equal(max, 36); return picks.shift(); };

  // Act
  const code = generateBookingCode(new Date('2026-11-21T03:00:00Z'), randomInt);

  // Assert
  assert.equal(code, 'ARMJ20261121K9AZ');
});

test('date stamp uses WIB: 17:30 UTC on the 20th is already the 21st in Jakarta', () => {
  // Act
  const lateUtc = jakartaDateStamp(new Date('2026-11-20T17:30:00Z'));
  const justBefore = jakartaDateStamp(new Date('2026-11-20T16:59:59Z'));
  const yearEnd = jakartaDateStamp(new Date('2026-12-31T17:00:00Z'));

  // Assert
  assert.equal(lateUtc, '20261121');
  assert.equal(justBefore, '20261120');
  assert.equal(yearEnd, '20270101');
});

test('retry: a booking code collision rolls back to the savepoint and tries a new code', async () => {
  // Arrange
  const client = fakeClient();
  const codes = ['ARMJ20261121AAAA', 'ARMJ20261121BBBB'];
  const tried = [];
  const insert = async (code) => {
    tried.push(code);
    if (tried.length === 1) throw conflict('dim_cust_booking_code_key');
    return { booking_code: code };
  };

  // Act
  const row = await withBookingCode(client, insert, { generate: () => codes.shift() });

  // Assert
  assert.deepEqual(tried, ['ARMJ20261121AAAA', 'ARMJ20261121BBBB']);
  assert.equal(row.booking_code, 'ARMJ20261121BBBB');
  assert.deepEqual(client.queries, [
    'savepoint booking_code_attempt',
    'rollback to savepoint booking_code_attempt',
    'savepoint booking_code_attempt',
    'release savepoint booking_code_attempt',
  ]);
});

test('retry: gives up after MAX_ATTEMPTS collisions and rethrows the 23505', async () => {
  // Arrange
  const client = fakeClient();
  let calls = 0;
  const insert = async () => { calls += 1; throw conflict(); };

  // Act and Assert
  await assert.rejects(withBookingCode(client, insert), { code: '23505' });
  assert.equal(calls, MAX_ATTEMPTS);
  assert.equal(MAX_ATTEMPTS, 5);
});

test('retry: other errors, including other unique keys, are not retried', async () => {
  // Arrange
  const client = fakeClient();
  let calls = 0;
  const insert = async () => { calls += 1; throw conflict('dim_user_username_key'); };

  // Act and Assert
  await assert.rejects(withBookingCode(client, insert), { constraint: 'dim_user_username_key' });
  assert.equal(calls, 1);
});
