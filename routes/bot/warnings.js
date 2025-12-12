const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// POST /api/bot/warnings/add
router.post('/add', async (req, res) => {
  const { user_id, user_tag, admin_id, guild_id, reason, duration_hours } = req.body;
  if (!user_id || !user_tag || !admin_id || !guild_id || !reason) return res.status(400).json({ error: 'missing_fields' });
  try {
    const q = `INSERT INTO warnings (user_id, user_tag, admin_id, guild_id, reason, duration_hours, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`;
    const expiresAt = duration_hours ? new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString() : null;
    const r = await db.query(q, [user_id, user_tag, admin_id, guild_id, reason, duration_hours || null, expiresAt]);
    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/warnings/active/:userId/:guildId
router.get('/active/:userId/:guildId', async (req, res) => {
  const { userId, guildId } = req.params;
  try {
    const r = await db.query('SELECT * FROM warnings WHERE user_id = $1 AND guild_id = $2 AND is_active = true ORDER BY created_at DESC', [userId, guildId]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/warnings/all/:userId/:guildId
router.get('/all/:userId/:guildId', async (req, res) => {
  const { userId, guildId } = req.params;
  try {
    const r = await db.query('SELECT * FROM warnings WHERE user_id = $1 AND guild_id = $2 ORDER BY created_at DESC', [userId, guildId]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/warnings/expired
router.get('/expired', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const r = await db.query('SELECT * FROM warnings WHERE expires_at IS NOT NULL AND expires_at <= $1 AND is_active = true', [now]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// POST /api/bot/warnings/clear
router.post('/clear', async (req, res) => {
  const { user_id, guild_id } = req.body;
  if (!user_id || !guild_id) return res.status(400).json({ error: 'missing_fields' });
  try {
    const r = await db.query('UPDATE warnings SET is_active = false WHERE user_id = $1 AND guild_id = $2 AND is_active = true', [user_id, guild_id]);
    res.json({ changed: r.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/warnings/active_guild/:guildId
router.get('/active_guild/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  try {
    const r = await db.query('SELECT * FROM warnings WHERE guild_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT $2', [guildId, limit]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// POST /api/bot/warnings/expire
router.post('/expire', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const r = await db.query('UPDATE warnings SET is_active = false WHERE expires_at IS NOT NULL AND expires_at <= $1 AND is_active = true', [now]);
    res.json({ changed: r.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;
