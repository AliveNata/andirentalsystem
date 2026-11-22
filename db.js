const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Default 0 waits forever, which would hang the health check and every request when the DB is down.
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
