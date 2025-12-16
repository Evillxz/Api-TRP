const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

const userStatusCache = new Map();


function updateUserStatus(userId, status, roles = []) {
  userStatusCache.set(userId, {
    status: status,
    roles: roles,
    updatedAt: new Date()
  });
  
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  for (const [key, value] of userStatusCache.entries()) {
    if (value.updatedAt < fiveMinutesAgo) {
      userStatusCache.delete(key);
    }
  }
}

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
        updateUserStatus(user.userId, user.status, user.roles || []);
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
