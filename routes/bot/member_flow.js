const express = require('express');
const router = express.Router();
const db = require('db');

router.post('/', async (req, res) => {
  const { user_id, user_tag, action, created_at } = req.body;

  if (!user_id || !user_tag || !action) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!['join', 'leave'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  try {
    if (created_at) {
      await db.query(
        'INSERT INTO member_flow (user_id, user_tag, action, created_at) VALUES ($1, $2, $3, $4)',
        [user_id, user_tag, action, created_at]
      );
    } else {
      await db.query(
        'INSERT INTO member_flow (user_id, user_tag, action) VALUES ($1, $2, $3)',
        [user_id, user_tag, action]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error('[Member Flow] Error logging flow:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;