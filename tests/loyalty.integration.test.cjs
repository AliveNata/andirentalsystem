// Runs LOYALTY_SQL against temp tables that shadow fact_transaction and dim_cust (pg_temp is
// searched first), inside a transaction that is rolled back. Real rows are never read or written.
// Skipped unless the DB_* settings in .env reach a database.
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { LOYALTY_SQL } = require('../lib/loyalty');

const skip = !process.env.DB_HOST && 'set DB_HOST and the other DB_* variables';
let pool;

after(async () => {
  if (pool) await pool.end();
});

const CUST_A = '00000000-0000-4000-8000-00000000000a';
const CUST_A_DUP = '00000000-0000-4000-8000-0000000000a2';
const CUST_B = '00000000-0000-4000-8000-00000000000b';

async function runWithFixtures(fixtures) {
  pool = pool || require('../db');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`create temp table dim_cust (id uuid primary key, email text, name text, whatsapp text, address text) on commit drop`);
    await client.query(`create temp table fact_transaction (
      id uuid primary key default gen_random_uuid(), customer_id uuid, email text, name text,
      whatsapp text, address text, created_at timestamptz, deleted boolean not null default false
    ) on commit drop`);
    for (const c of fixtures.customers) {
      await client.query('insert into dim_cust values ($1, $2, $3, $4, $5)', [c.id, c.email, c.name, c.whatsapp, c.address]);
    }
    for (const t of fixtures.transactions) {
      await client.query(
        'insert into fact_transaction (customer_id, email, name, whatsapp, address, created_at, deleted) values ($1, $2, $3, $4, $5, $6, $7)',
        [t.customer_id ?? null, t.email, t.name, t.whatsapp, t.address, t.created_at, t.deleted ?? false],
      );
    }
    const { rows } = await client.query(LOYALTY_SQL);
    return rows;
  } finally {
    await client.query('rollback');
    client.release();
  }
}

const identity = { email: 'a@example.com', name: 'Ani', whatsapp: '0812', address: 'Jl. A' };

test('duplicate dim_cust rows no longer multiply the transaction count', { skip }, async () => {
  // Arrange: two identical dim_cust rows; the old four-column join counted each transaction twice.
  const fixtures = {
    customers: [{ id: CUST_A, ...identity }, { id: CUST_A_DUP, ...identity }],
    transactions: [
      { customer_id: CUST_A, ...identity, created_at: '2026-01-01' },
      { customer_id: CUST_A, ...identity, created_at: '2026-02-01' },
      { customer_id: CUST_A, ...identity, created_at: '2026-03-01' },
      { customer_id: CUST_A, ...identity, created_at: '2026-04-01', deleted: true },
    ],
  };

  // Act
  const rows = await runWithFixtures(fixtures);

  // Assert
  assert.deepEqual(rows, [{ group_key: 'email:a@example.com', customer_id: CUST_A, ...identity, transaction_count: 3 }]);
});

test('a returning customer with a new dim_cust row per booking stays one row', { skip }, async () => {
  // Arrange: same email under two customer ids plus one legacy row without customer_id.
  const fixtures = {
    customers: [
      { id: CUST_A, ...identity, address: 'Jl. Lama' },
      { id: CUST_A_DUP, ...identity, address: 'Jl. Baru' },
    ],
    transactions: [
      { email: 'A@Example.com ', name: 'Ani', whatsapp: '0812', address: 'Jl. Dulu', created_at: '2025-01-01' },
      { customer_id: CUST_A, ...identity, created_at: '2026-01-01' },
      { customer_id: CUST_A_DUP, ...identity, created_at: '2026-02-01' },
    ],
  };

  // Act
  const rows = await runWithFixtures(fixtures);

  // Assert: fields come from the dim_cust row of the latest transaction.
  assert.deepEqual(rows, [{ group_key: 'email:a@example.com', customer_id: CUST_A_DUP, ...identity, address: 'Jl. Baru', transaction_count: 3 }]);
});

test('rows without customer_id show the identity of their latest transaction, ordered by count', { skip }, async () => {
  // Arrange
  const fixtures = {
    customers: [{ id: CUST_B, email: 'b@example.com', name: 'Budi', whatsapp: '0813', address: 'Jl. B' }],
    transactions: [
      { customer_id: CUST_B, email: 'b@example.com', name: 'Budi lama', whatsapp: 'x', address: 'x', created_at: '2026-01-01' },
      { email: 'Legacy@Example.com ', name: 'Lama', whatsapp: '0814', address: 'Jl. L', created_at: '2025-01-01' },
      { email: 'legacy@example.com', name: 'Terbaru', whatsapp: '0815', address: 'Jl. T', created_at: '2025-06-01' },
    ],
  };

  // Act
  const rows = await runWithFixtures(fixtures);

  // Assert: the customer_id row takes its fields from dim_cust, not from the transaction.
  assert.deepEqual(rows, [
    { group_key: 'email:legacy@example.com', customer_id: null, email: 'legacy@example.com', name: 'Terbaru', whatsapp: '0815', address: 'Jl. T', transaction_count: 2 },
    { group_key: 'email:b@example.com', customer_id: CUST_B, email: 'b@example.com', name: 'Budi', whatsapp: '0813', address: 'Jl. B', transaction_count: 1 },
  ]);
});
