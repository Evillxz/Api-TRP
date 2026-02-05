const express = require('express');
const router = express.Router();

router.get('/history', async (_req, res) => {

  res.set({
    'Deprecation': 'true',
    'Sunset': 'Wed, 31 Dec 2026 23:59:59 GMT',
  });

  res.status(410).json({
    error: 'gone',
    message: '299 - "Deprecated endpoint" | New endpoint coming soon.',
    replacement: '/api/v2/status-history (Available soon)'
  });

});

router.get('/', (_req, res) => {
  
  res.set({
    'Deprecation': 'true',
    'Sunset': 'Wed, 31 Dec 2026 23:59:59 GMT',
  });

  res.status(410).json({
    error: 'gone',
    message: '299 - "Deprecated endpoint" | New endpoint coming soon.',
    replacement: '/api/v2/status-systems (Available soon)'
  });

});


module.exports = router;