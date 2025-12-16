const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// POST /api/bot/game_sessions/add
router.post('/add', async (req, res) => {
  const { user_id, guild_id, game_name, started_at, ended_at, duration_minutes } = req.body;
  if (!user_id || !guild_id || !started_at || !ended_at || !duration_minutes) return res.status(400).json({ error: 'missing_fields' });
  try {
    const q = `INSERT INTO game_sessions (user_id, guild_id, game_name, started_at, ended_at, duration_minutes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`;
    const r = await db.query(q, [user_id, guild_id, game_name, started_at, ended_at, duration_minutes]);
    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/game_sessions/list/:guildId
router.get('/list/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  try {
    const r = await db.query('SELECT * FROM game_sessions WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2', [guildId, limit]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/game_sessions/user/:userId
router.get('/user/:userId', async (req, res) => {
  const userId = req.params.userId;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
  try {
    const r = await db.query('SELECT * FROM game_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// DELETE /api/bot/game_sessions/delete/:id
router.delete('/delete/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const r = await db.query('DELETE FROM game_sessions WHERE id = $1 RETURNING id', [id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;