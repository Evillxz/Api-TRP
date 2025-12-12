const express = require('express');
const router = express.Router();
const botRaffle = require('./bot/raffle');
const botBans = require('./bot/bans');
const botWarnings = require('./bot/warnings');
const botEvents = require('./bot/events');
const botUpReb = require('./bot/up_reb_logs');
const siteRegister = require('./site/register');

router.use('/bot/raffle', botRaffle);
router.use('/bot/bans', botBans);
router.use('/bot/warnings', botWarnings);
router.use('/bot/events', botEvents);
router.use('/bot/up_reb_logs', botUpReb);
router.use('/site/register', siteRegister);

module.exports = router;
