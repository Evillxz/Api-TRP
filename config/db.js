const { Pool } = require('pg');
const logger = require('../utils/logger') || console;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD ? String(process.env.POSTGRES_PASSWORD) : undefined
});

pool.on('error', (err) => {
  logger.error && logger.error('[API DB] Unexpected error on idle client', err);
});

// Test initial connection and log status
(async () => {
  try {
    const client = await pool.connect();
    client.release();
    logger.log && logger.log('[API DB] Connected to Postgres');
  } catch (err) {
    logger.error && logger.error('[API DB] Connection error:', err && err.message ? err.message : err);
  }
})();

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};

// Ensure required tables exist (idempotent)
async function ensureTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS bans (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS kicks (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS warnings (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration_hours INTEGER,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS up_reb_logs (
      id SERIAL PRIMARY KEY,
      action_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      admin_tag TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      old_role_id TEXT NOT NULL,
      new_role_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS event_registrations (
      id SERIAL PRIMARY KEY,
      discord_id TEXT NOT NULL,
      discord_tag TEXT NOT NULL,
      game_nick TEXT NOT NULL,
      game_id TEXT NOT NULL,
      proof_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS register (
      id SERIAL PRIMARY KEY,
      user_name TEXT NOT NULL,
      user_discord_name TEXT,
      user_id TEXT NOT NULL,
      user_game_id TEXT NOT NULL,
      user_telephone TEXT NOT NULL,
      user_shift TEXT NOT NULL,
      rec_id TEXT NOT NULL,
      approver_id TEXT NOT NULL,
      approver_tag TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS raffle (
      id SERIAL PRIMARY KEY,
      discord_name TEXT NOT NULL,
      discord_tag TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      participating BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const q of queries) {
    await pool.query(q).catch(err => {
      logger.error && logger.error('[API DB] error creating table:', err.message || err);
      throw err;
    });
  }
}

module.exports.ensureTables = ensureTables;
