const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// POST /api/bot/raffle/join
router.post('/join', async (req, res) => {
  const { discord_name, discord_tag, discord_id } = req.body;
  if (!discord_id || !discord_name) return res.status(400).json({ error: 'missing_fields' });
  try {
    const q = `INSERT INTO raffle (discord_name, discord_tag, discord_id, participating) VALUES ($1,$2,$3,$4) RETURNING id`;
    const r = await db.query(q, [discord_name, discord_tag || '', discord_id, true]);
    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/raffle/active
router.get('/active', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM raffle WHERE participating = true ORDER BY created_at ASC');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/raffle/user/:id
router.get('/user/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const r = await db.query('SELECT * FROM raffle WHERE discord_id = $1 LIMIT 1', [id]);
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// POST /api/bot/raffle/toggle
router.post('/toggle', async (req, res) => {
  const { discord_id, participating } = req.body;
  if (!discord_id || typeof participating === 'undefined') return res.status(400).json({ error: 'missing_fields' });
  try {
    const existing = await db.query('SELECT id FROM raffle WHERE discord_id = $1 LIMIT 1', [discord_id]);
    if (existing.rows.length === 0) {
      const r = await db.query('INSERT INTO raffle (discord_name, discord_tag, discord_id, participating) VALUES ($1,$2,$3,$4) RETURNING id', ['unknown', '', discord_id, participating]);
      return res.json({ id: r.rows[0].id });
    }
    const r = await db.query('UPDATE raffle SET participating = $1 WHERE discord_id = $2 RETURNING *', [participating, discord_id]);
    res.json({ updated: r.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;
