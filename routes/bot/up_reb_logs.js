const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// POST /api/bot/up_reb_logs/add
router.post('/add', async (req, res) => {
  const { action_type, user_id, user_tag, admin_id, admin_tag, guild_id, old_role_id, new_role_id, reason } = req.body;
  if (!action_type || !user_id || !user_tag || !admin_id || !admin_tag || !guild_id || !old_role_id || !new_role_id || !reason) return res.status(400).json({ error: 'missing_fields' });
  try {
    const q = `INSERT INTO up_reb_logs (action_type, user_id, user_tag, admin_id, admin_tag, guild_id, old_role_id, new_role_id, reason) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`;
    const r = await db.query(q, [action_type, user_id, user_tag, admin_id, admin_tag, guild_id, old_role_id, new_role_id, reason]);
    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/up_reb_logs/:guildId
router.get('/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
  try {
    const r = await db.query('SELECT * FROM up_reb_logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2', [guildId, limit]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;
