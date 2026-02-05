const express = require('express');
const router = express.Router();
const logger = require('logger');
const { sendRequest } = require('../../wsServer');

const GUILD_ID = process.env.GUILD_ID || '1295702106195492894';

router.get('/', async (_req, res) => {
  try {
    const result = await sendRequest('get_guild_members', { 
      guildId: GUILD_ID,
      page: 1, 
      limit: 600 
    });

    const members = (result.success && result.data) ? result.data.members : [];

    const users = members.map(m => ({
      userId: m.id,
      status: m.status, 
      roles: m.roles,   
      username: m.username,
      nickname: m.nickname,
      avatar: m.avatar,
      updatedAt: new Date(),
      joinedAt: m.joinedAt,
      activity: m.activity
    }));

    res.json(users);

  } catch (err) {
    logger.error('[User Status] Erro ao listar status de usuários via WS:', err);
    res.status(500).json([]);
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await sendRequest('get_user_profile', {
      guildId: GUILD_ID,
      userId
    });

    if (result.success && result.data) {
      return res.json({
        userId: result.data.id,
        status: result.data.status,
        roles: result.data.roles.map(r => r.id),
        lastUpdate: new Date()
      });
    }
    
    res.json({
      userId,
      status: 'offline',
      roles: [],
      lastUpdate: null
    });

  } catch (err) {
    logger.error(`[User Status] Erro ao buscar status do usuário ${req.params.userId}:`, err);
    res.status(500).json({ error: 'server_error', detail: err.message });
  }
});

router.post('/batch', (_req, res) => {
  res.status(200).json({ message: 'Endpoint deprecated: Use WebSocket' });
});

module.exports = router;