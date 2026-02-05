const express = require('express');
const router = express.Router();
const { sendRequest } = require('wsServer'); 

router.post('/warn', async (req, res) => {
  try {
    const { userId, guildId, reason, durationHours, adminId, level } = req.body;
    if (!userId || !guildId || !reason) return res.status(400).json({ error: 'Dados incompletos' });

    const result = await sendRequest('apply_warning', {
      userId, guildId, reason, durationHours, adminId, level
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/exonerate', async (req, res) => {
  try {
    const { userId, guildId, reason, adminId } = req.body;
    if (!userId || !guildId) return res.status(400).json({ error: 'Dados incompletos' });

    const result = await sendRequest('apply_exoneration', {
      userId, guildId, reason, adminId
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;