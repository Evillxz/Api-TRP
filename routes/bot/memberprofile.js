const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../../config/db');

const schema = Joi.object({
  user_name: Joi.string().required(),
  user_discord_tag: Joi.string().allow('', null),
  user_discord_nick: Joi.string().allow('', null),
  user_id: Joi.string().required(),
  user_game_id: Joi.string().required(),
  user_telephone: Joi.string().required(),
  user_shift: Joi.string().required(),
  rec_id: Joi.string().required(),
  approver_id: Joi.string().required(),
  approver_tag: Joi.string().required(),
  approver_nick: Joi.string().required(),
  guild_id: Joi.string().required(),
  recruited_at: Joi.string().required()
});

// POST /api/bot/register
router.post('/', async (req, res) => {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: 'validation', details: error.details });
  try {
    const q = `INSERT INTO member_profile (user_name, user_discord_tag, user_discord_nick, user_id, user_game_id, user_telephone, user_shift, rec_id, approver_id, approver_tag, approver_nick, guild_id, recruited_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`;
    const params = [
      value.user_name,
      value.user_discord_tag,
      value.user_discord_nick,
      value.user_id,
      value.user_game_id,
      value.user_telephone,
      value.user_shift,
      value.rec_id,
      value.approver_id,
      value.approver_tag,
      value.approver_nick,
      value.guild_id,
      value.recruited_at
    ];
    const r = await db.query(q, params);
    res.json({ id: r.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

// GET /api/bot/register/:userId/:guildId
router.get('/:userId/:guildId', async (req, res) => {
  const { userId, guildId } = req.params;
  try {
    const r = await db.query('SELECT * FROM register WHERE user_id = $1 AND guild_id = $2 LIMIT 1', [userId, guildId]);
    res.json(r.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: 'db_error', detail: err.message });
  }
});

module.exports = router;