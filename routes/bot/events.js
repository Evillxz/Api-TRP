const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// POST /api/bot/events/register
router.post('/register', async (req, res) => {
  const { discord_id, discord_tag, game_nick, game_id, proof_url } = req.body;
  if (!discord_id || !discord_tag || !game_nick || !game_id || !proof_url) return res.status(400).json({ error: 'missing_fields' });
  try {
    const q = `INSERT INTO event_registrations (discord_id, discord_tag, game_nick, game_id, proof_url) VALUES ($1,$2,$3,$4,$5) RETURNING id`;
    const r = await db.query(q, [discord_id, discord_tag, game_nick, game_id, proof_url]);
    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/events/list
router.get('/list', async (req, res) => {
  try {
    const r = await db.query('SELECT id, game_nick, game_id, proof_url FROM event_registrations ORDER BY created_at ASC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/events/user/:discordId
router.get('/user/:discordId', async (req, res) => {
  const discordId = req.params.discordId;
  try {
    const r = await db.query('SELECT id FROM event_registrations WHERE discord_id = $1 LIMIT 1', [discordId]);
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// DELETE /api/bot/events/:id
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const r = await db.query('DELETE FROM event_registrations WHERE id = $1', [id]);
    res.json({ deleted: r.rowCount > 0 });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;
