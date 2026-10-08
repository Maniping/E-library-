const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: true },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

function requirePool() {
  if (!pool) {
    const error = new Error("Supabase database is not configured. Set DATABASE_URL.");
    error.status = 503;
    throw error;
  }
  return pool;
}

async function query(text, params) {
  return requirePool().query(text, params);
}

module.exports = { pool, query, requirePool };
