const express = require('express');
const router = express.Router();
const botBans = require('./bot/bans');
const botWarnings = require('./bot/warnings');
const botUpReb = require('./bot/up_reb_logs');
const botMemberprofile = require('./bot/memberprofile');
const botGameSessions = require('./bot/game_sessions');
const siteRaffles = require('./site/raffles');
const siteRecruitment = require('./site/recruitment');

router.use('/bot/bans', botBans);
router.use('/bot/warnings', botWarnings);
router.use('/bot/up_reb_logs', botUpReb);
router.use('/bot/memberprofile', botMemberprofile);
router.use('/bot/game_sessions', botGameSessions);
router.use('/raffle', siteRaffles);
router.use('/site/recruitment', siteRecruitment);

module.exports = router;