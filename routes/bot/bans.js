const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// POST /api/bot/bans/add
router.post('/add', async (req, res) => {
  const { user_id, user_nickname, user_tag, admin_id, guild_id, reason } = req.body;
  console.log('[DEBUG] Received ban data:', { user_id, user_nickname, user_tag, admin_id, guild_id, reason });
  if (!user_id || !user_nickname || !user_tag || !admin_id || !guild_id || !reason) {
    console.log('[DEBUG] Missing fields');
    return res.status(400).json({ error: 'missing_fields' });
  }
  try {
    const q = `INSERT INTO bans (user_id, user_nickname, user_tag, admin_id, guild_id, reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`;

    console.log('[DEBUG] Executing query:', q, [user_id, user_nickname, user_tag, admin_id, guild_id, reason]);

    const r = await db.query(q, [user_id, user_nickname, user_tag, admin_id, guild_id, reason]);

    console.log('[DEBUG] Query result:', r.rows);
    res.json({ id: r.rows[0].id });

  } catch (err) {
    console.error('[API] POST /api/bot/bans/add error:', err);
    console.error('[API] Error details:', err.message, err.stack);

    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/bans/list/:guildId
router.get('/list/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  try {
    
    const r = await db.query('SELECT * FROM bans WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2', [guildId, limit]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;
