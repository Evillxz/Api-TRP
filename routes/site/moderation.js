const express = require('express');
const router = express.Router();
const { sendToBot } = require('../../wsServer');
const logger = require('../../utils/logger');

router.post('/warn', async (req, res) => {
  try {
    const { userId, guildId, reason, durationHours, adminId, level } = req.body;
    
    if (!userId || !guildId || !reason || !adminId || !level) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sendToBot('apply_warning', {
      userId,
      guildId,
      reason,
      durationHours,
      adminId,
      level
    });

    res.json(result);
  } catch (error) {
    logger.error('Error applying warning:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/exonerate', async (req, res) => {
  try {
    const { userId, guildId, reason, adminId } = req.body;
    
    if (!userId || !guildId || !reason || !adminId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await sendToBot('apply_exoneration', {
      userId,
      guildId,
      reason,
      adminId
    });

    res.json(result);
  } catch (error) {
    logger.error('Error applying exoneration:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;