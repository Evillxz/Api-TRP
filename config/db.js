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

async function ensureTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS bans (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_nickname TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS warnings (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      user_nickname TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      admin_tag TEXT NOT NULL,
      admin_nickname TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      duration_hours INTEGER,
      level INTEGER,
      expires_at TIMESTAMP WITH TIME ZONE,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS member_profile (
      id SERIAL PRIMARY KEY,
      user_name TEXT NOT NULL,
      user_discord_tag TEXT NOT NULL,
      user_discord_nick TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_game_id TEXT NOT NULL,
      user_telephone TEXT NOT NULL,
      user_shift TEXT NOT NULL,
      rec_id TEXT NOT NULL,
      approver_id TEXT NOT NULL,
      approver_tag TEXT NOT NULL,
      approver_nick TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      recruited_at TEXT NOT NULL,
      discord_status TEXT DEFAULT 'offline',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS raffle (
      id SERIAL PRIMARY KEY,
      discord_name TEXT NOT NULL,
      discord_tag TEXT NOT NULL,
      discord_id TEXT NOT NULL,
      participating BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS raffles (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      max_participants INTEGER,
      auto_close_min INTEGER,
      auto_close_date TIMESTAMP WITH TIME ZONE,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'finished')),
      created_by TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS raffle_participants (
      id SERIAL PRIMARY KEY,
      raffle_id INTEGER REFERENCES raffles(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      discord_name TEXT NOT NULL,
      discord_tag TEXT NOT NULL,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS game_sessions (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      guild_id VARCHAR(50) NOT NULL,
      game_name VARCHAR(100),
      started_at TIMESTAMP WITH TIME ZONE NOT NULL,
      ended_at TIMESTAMP WITH TIME ZONE NOT NULL,
      duration_minutes INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_sessions_user ON game_sessions(user_id)`,

    `CREATE TABLE IF NOT EXISTS recruitment_cycles (
      id SERIAL PRIMARY KEY,
      is_open BOOLEAN DEFAULT false,
      slots INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      closed_at TIMESTAMP WITH TIME ZONE
    )`,

    `CREATE TABLE IF NOT EXISTS recruitment_applications (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      cycle_id INTEGER REFERENCES recruitment_cycles(id),
      status TEXT NOT NULL,
      data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE TABLE IF NOT EXISTS service_status_logs (
      id SERIAL PRIMARY KEY,
      service_name TEXT NOT NULL,
      status TEXT NOT NULL,
      latency INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_service_status_created_at ON service_status_logs(created_at)`,
    `CREATE TABLE IF NOT EXISTS member_flow (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_tag TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('join', 'leave')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )`,

    `CREATE INDEX IF NOT EXISTS idx_member_flow_created_at ON member_flow(created_at)`,

    `ALTER TABLE warnings ADD COLUMN IF NOT EXISTS user_nickname TEXT`,
    `ALTER TABLE warnings ADD COLUMN IF NOT EXISTS admin_tag TEXT`,
    `ALTER TABLE warnings ADD COLUMN IF NOT EXISTS admin_nickname TEXT`,
    `ALTER TABLE warnings ADD COLUMN IF NOT EXISTS level INTEGER`
  ];

  for (const q of queries) {
    await pool.query(q).catch(err => {
      logger.error && logger.error('[API DB] error creating table:', err.message || err);
      throw err;
    });
  }
}

module.exports.ensureTables = ensureTables;
