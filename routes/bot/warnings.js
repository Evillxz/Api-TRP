const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// POST /api/bot/warnings/add
router.post('/add', async (req, res) => {
  const { user_id, user_tag, user_nickname, admin_id, admin_tag, admin_nickname, guild_id, reason, duration_hours, level } = req.body;
  if (!user_id || !user_tag || !user_nickname || !admin_id || !admin_tag || !admin_nickname || !guild_id || !reason) return res.status(400).json({ error: 'missing_fields' });
  try {
    
    let expires_at = null;
    if (duration_hours) {
      const hours = parseInt(duration_hours);
      if (!isNaN(hours)) {
        expires_at = new Date(Date.now() + hours * 60 * 60 * 1000);
      }
    }

    const q = `INSERT INTO warnings (user_id, user_tag, user_nickname, admin_id, admin_tag, admin_nickname, guild_id, reason, duration_hours, level, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11) RETURNING id`;
    const r = await db.query(q, [user_id, user_tag, user_nickname, admin_id, admin_tag, admin_nickname, guild_id, reason, duration_hours || null, level || null, expires_at]);
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
    const r = await db.query('SELECT * FROM warnings WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND is_active = true');
    res.json(r.rows);
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
    const r = await db.query('UPDATE warnings SET is_active = false WHERE expires_at IS NOT NULL AND expires_at <= NOW() AND is_active = true');
    res.json({ changed: r.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;