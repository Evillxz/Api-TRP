const packageJson = require('../package.json');
const express = require('express');
const router = express.Router();

// Health check
router.get('/', (_req, res) => {
  res.json({ 
    success: true,
    health: 'OK',
    protected: true,
    message: 'Official API Trindade Penumbra',
    version: packageJson.version,
    ram: process.memoryUsage().rss,
    uptime: process.uptime()
  });
});

router.use('/status', require('./site/status'));

// Bot routes
router.use('/bot/bans', require('./bot/bans'));
router.use('/bot/warnings', require('./bot/warnings'));
router.use('/bot/up_reb_logs', require('./bot/up_reb_logs'));
router.use('/bot/memberprofile', require('./bot/memberprofile'));
router.use('/bot/member_flow', require('./bot/member_flow'));

// Site routes
router.use('/site/raffle', require('./site/raffles'));
router.use('/site/recruitment', require('./site/recruitment'));
router.use('/site/server-data', require('./site/server-data'));
router.use('/site/dashboard', require('./site/dashboard'));
router.use('/site/embeds', require('./site/embeds'));
router.use('/site/user_status', require('./site/user_status'));
router.use('/site/upload', require('./site/upload'));
router.use('/api/site/moderation', require('./site/moderation'));
router.use('/site/componentsv2', require('./site/embeds'));
router.use('/site/componentsV2', require('./site/componentsV2'));

module.exports = router;