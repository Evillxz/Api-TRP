const express = require('express');
const router = express.Router();
const db = require('db');
const logger = require('logger');
const { sendRequest } = require('wsServer');

router.post('/create', async (req, res) => {
  const { title, description, max_participants, auto_close_min, auto_close_date, image_url } = req.body;
  const created_by = req.user?.id || 'admin';

  if (!title || !description) return res.status(400).json({ error: 'missing_fields' });

  try {
    const q = `INSERT INTO raffles (title, description, image_url, max_participants, auto_close_min, auto_close_date, created_by) 
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
    const r = await db.query(q, [title, description, image_url, max_participants || null, auto_close_min || null, auto_close_date || null, created_by]);

    try {
      await sendRequest('create_raffle', {
        id: r.rows[0].id,
        title,
        description,
        image_url,
        image_path: null
      });
    } catch (wsError) {
      logger.warn('[Raffles] Sorteio criado no DB, mas falha ao avisar Bot:', wsError.message);
    }

    res.json({ id: r.rows[0].id });
  } catch (err) {
    logger.error('[Raffles] Erro ao criar:', err);
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

router.get('/list', async (_req, res) => {
  try {
    const raffles = await db.query(`
      SELECT r.*, 
             COALESCE(json_agg(p) FILTER (WHERE p.id IS NOT NULL), '[]') as participants
      FROM raffles r
      LEFT JOIN raffle_participants p ON r.id = p.raffle_id
      GROUP BY r.id
      ORDER BY r.created_at DESC
    `);
    res.json(raffles.rows);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const raffle = await db.query(`
      SELECT r.*, 
             COALESCE(json_agg(p) FILTER (WHERE p.id IS NOT NULL), '[]') as participants
      FROM raffles r
      LEFT JOIN raffle_participants p ON r.id = p.raffle_id
      WHERE r.id = $1
      GROUP BY r.id
    `, [id]);
    if (raffle.rows.length === 0) return res.status(404).json({ error: 'not_found' });

    res.json(raffle.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

router.put('/:id/start', async (req, res) => {
  const id = req.params.id;
  try {
    const participants = await db.query('SELECT * FROM raffle_participants WHERE raffle_id = $1', [id]);
    if (participants.rows.length === 0) return res.status(400).json({ error: 'no_participants' });

    const winner = participants.rows[Math.floor(Math.random() * participants.rows.length)];

    await db.query('UPDATE raffles SET status = $1 WHERE id = $2', ['finished', id]);

    try {

      sendRequest('raffle_winner', {
        raffle_id: id,
        winner: winner
      });

    } catch (wsError) {
      logger.warn('[Raffles] Sorteio iniciado no DB, mas falha ao avisar Bot:', wsError.message);
    }

    res.json({ winner });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

router.post('/:id/add-participant', async (req, res) => {
  const { discord_id, discord_name, discord_tag } = req.body;
  const raffle_id = req.params.id;

  if (!discord_id || !discord_name) return res.status(400).json({ error: 'missing_fields' });

  try {
    const raffleResult = await db.query('SELECT * FROM raffles WHERE id = $1', [raffle_id]);
    if (raffleResult.rows.length === 0) return res.status(404).json({ error: 'not_found' });
    
    const raffle = raffleResult.rows[0];
    
    if (raffle.auto_close_date && new Date() >= new Date(raffle.auto_close_date)) {
        return res.status(400).json({ error: 'raffle_closed_by_date' });
    }
    
    if (raffle.status !== 'active') return res.status(400).json({ error: 'raffle_closed' });

    const countResult = await db.query('SELECT COUNT(*) FROM raffle_participants WHERE raffle_id = $1', [raffle_id]);
    const currentCount = parseInt(countResult.rows[0].count);

    if (raffle.max_participants && currentCount >= raffle.max_participants) {
      return res.status(400).json({ error: 'raffle_full' });
    }

    const q = `INSERT INTO raffle_participants (raffle_id, discord_id, discord_name, discord_tag) 
               VALUES ($1, $2, $3, $4) RETURNING id`;
    const r = await db.query(q, [raffle_id, discord_id, discord_name, discord_tag]);
    
    const newCount = currentCount + 1;
    if (raffle.auto_close_min && newCount >= raffle.auto_close_min) {
       await db.query("UPDATE raffles SET status = 'closed' WHERE id = $1", [raffle_id]);
       console.log(`Sorteio ${raffle_id} fechado automaticamente (meta atingida).`);
    }

    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

router.delete('/:id/remove-participant/:participantId', async (req, res) => {
  const participantId = req.params.participantId;
  try {
    await db.query('DELETE FROM raffle_participants WHERE id = $1', [participantId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;