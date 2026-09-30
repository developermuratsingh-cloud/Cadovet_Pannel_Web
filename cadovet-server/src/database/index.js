const { Pool, types } = require('pg');
const path = require('path');

// Return DATE columns (OID 1082) as plain 'YYYY-MM-DD' strings. By default pg builds a JS Date in the
// server's local timezone, which serialises to the previous day in UTC (e.g. 2026-10-04T18:30:00.000Z).
types.setTypeParser(1082, (value) => value);
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
