// Runs DASHBOARD_SUMMARY_SQL against temp tables that shadow fact_transaction and dim_car (pg_temp is
// searched first), inside a transaction that is rolled back. Real rows are never read or written.
// Skipped unless the DB_* settings in .env reach a database.
require('dotenv').config();
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { getDashboardSummary } = require('../lib/dashboardSummary');

const skip = !process.env.DB_HOST && 'set DB_HOST and the other DB_* variables';
let pool;

after(async () => {
  if (pool) await pool.end();
});

async function summaryWith({ transactions = [], cars = 0 }, at) {
  pool = pool || require('../db');
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`create temp table fact_transaction (
      id serial primary key, start_date date, end_date date,
      created_at timestamptz not null, deleted boolean not null default false
    ) on commit drop`);
    await client.query('create temp table dim_car (id serial primary key, name text) on commit drop');
    for (const t of transactions) {
      await client.query(
        'insert into fact_transaction (start_date, end_date, created_at, deleted) values ($1, $2, $3, $4)',
        [t.start_date, t.end_date ?? null, t.created_at ?? '2026-01-01T00:00:00Z', t.deleted ?? false],
      );
    }
    for (let i = 0; i < cars; i += 1) await client.query("insert into dim_car (name) values ('mobil')");
    return await getDashboardSummary(client, at);
  } finally {
    await client.query('rollback');
    client.release();
  }
}

test('active rentals use the Jakarta date and include both the start and end day', { skip }, async () => {
  // Arrange: 2026-05-10 18:00 UTC is already 2026-05-11 01:00 in Jakarta.
  const at = new Date('2026-05-10T18:00:00Z');
  const transactions = [
    { start_date: '2026-05-11', end_date: '2026-05-13' }, // starts today (Jakarta): counted
    { start_date: '2026-05-09', end_date: '2026-05-11' }, // ends today: counted
    { start_date: '2026-05-08', end_date: '2026-05-10' }, // ended yesterday in Jakarta, today in UTC: not counted
    { start_date: '2026-05-12', end_date: '2026-05-14' }, // starts tomorrow: not counted
    { start_date: '2026-05-11', end_date: null }, // no end date, one-day rental today: counted
    { start_date: '2026-05-10', end_date: '2026-05-12', deleted: true }, // deleted: not counted
  ];

  // Act
  const summary = await summaryWith({ transactions }, at);

  // Assert
  assert.equal(summary.active_rentals, 3);
});

test('bookings today are counted from Jakarta midnight to Jakarta midnight', { skip }, async () => {
  // Arrange: Jakarta 2026-05-11 runs from 2026-05-10T17:00Z to 2026-05-11T17:00Z.
  const at = new Date('2026-05-11T03:00:00Z');
  const transactions = [
    { start_date: '2026-06-01', created_at: '2026-05-10T17:00:00Z' }, // 00:00 WIB: counted
    { start_date: '2026-06-01', created_at: '2026-05-11T16:59:59Z' }, // 23:59:59 WIB: counted
    { start_date: '2026-06-01', created_at: '2026-05-10T16:59:59Z' }, // yesterday WIB: not counted
    { start_date: '2026-06-01', created_at: '2026-05-11T17:00:00Z' }, // tomorrow WIB: not counted
    { start_date: '2026-06-01', created_at: '2026-05-11T02:00:00Z', deleted: true }, // deleted: not counted
  ];

  // Act
  const summary = await summaryWith({ transactions }, at);

  // Assert
  assert.equal(summary.bookings_today, 2);
});

test('car models counts every dim_car row', { skip }, async () => {
  // Arrange / Act
  const summary = await summaryWith({ cars: 4 }, new Date('2026-05-11T03:00:00Z'));

  // Assert
  assert.equal(summary.car_models, 4);
  assert.equal(summary.active_rentals, 0);
  assert.equal(summary.bookings_today, 0);
});
