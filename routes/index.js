const express = require('express');
const router = express.Router();
const botRaffle = require('./bot/raffle');
const botBans = require('./bot/bans');
const botWarnings = require('./bot/warnings');
const botUpReb = require('./bot/up_reb_logs');
const botMemberprofile = require('./bot/memberprofile');
const botGameSessions = require('./bot/game_sessions');

router.use('/bot/raffle', botRaffle);
router.use('/bot/bans', botBans);
router.use('/bot/warnings', botWarnings);
router.use('/bot/up_reb_logs', botUpReb);
router.use('/bot/memberprofile', botMemberprofile);
router.use('/bot/game_sessions', botGameSessions);

module.exports = router;