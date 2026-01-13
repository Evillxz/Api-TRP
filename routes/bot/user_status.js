const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

const userStatusCache = new Map();

function updateUserStatus(userId, status, roles, extraData = {}) {
  const existingData = userStatusCache.get(userId) || {};
  
  const finalRoles = roles !== undefined ? roles : (existingData.roles || []);
  
  const finalData = {
    ...existingData,
    ...extraData,
    status: status,
    roles: finalRoles,
    updatedAt: new Date()
  };

  userStatusCache.set(userId, finalData);
  
  const fiveMinutesAgo = Date.now() - (15 * 60 * 1000); // Aumentado para 15 min
  for (const [key, value] of userStatusCache.entries()) {
    if (value.updatedAt < fiveMinutesAgo) {
      userStatusCache.delete(key);
    }
  }
}

router.get('/', async (req, res) => {
  try {
    const users = [];
    for (const [userId, data] of userStatusCache.entries()) {
      users.push({
        userId,
        ...data
      });
    }
    res.json(users);
  } catch (err) {
    logger.error('Erro ao listar usuários:', err);
    res.status(500).json({ error: 'server_error' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const cachedStatus = userStatusCache.get(userId);
    
    if (cachedStatus) {
      return res.json({
        userId,
        status: cachedStatus.status,
        roles: cachedStatus.roles || [],
        lastUpdate: cachedStatus.updatedAt
      });
    }
    
    res.json({
      userId,
      status: 'offline',
      roles: [],
      lastUpdate: null
    });
  } catch (err) {
    logger.error('Erro ao buscar status do usuário:', err);
    res.status(500).json({ error: 'server_error', detail: err.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { users } = req.body;
    
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'validation', message: 'users must be an array' });
    }
    
    users.forEach(user => {
      if (user.userId && user.status) {
        const { userId, status, roles, ...extraData } = user;

        updateUserStatus(userId, status, roles, extraData);
      }
    });
    
    res.json({ success: true, updated: users.length });
  } catch (err) {
    logger.error('Erro ao atualizar status em lote:', err);
    res.status(500).json({ error: 'server_error', detail: err.message });
  }
});

module.exports = router;
module.exports.updateUserStatus = updateUserStatus;