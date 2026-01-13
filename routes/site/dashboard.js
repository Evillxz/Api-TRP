const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const botClientStore = require('../../utils/botClientStore');

router.get('/', async (req, res) => {
  try {
    const serverData = botClientStore.getAllServerData();
    const totalMembers = serverData?.users?.length || 0;

    const pendingAppsRes = await db.query("SELECT COUNT(*) FROM recruitment_applications WHERE status NOT LIKE 'REJECTED%' AND status != 'APPROVED_PRACTICAL'");
    const pendingApps = parseInt(pendingAppsRes.rows[0].count);

    const activeRafflesRes = await db.query("SELECT COUNT(*) FROM raffles WHERE status = 'active'");
    const activeRaffles = parseInt(activeRafflesRes.rows[0].count);

    const recentBansRes = await db.query("SELECT COUNT(*) FROM bans WHERE created_at > NOW() - INTERVAL '24 hours'");
    const recentBans = parseInt(recentBansRes.rows[0].count);

    const recentAppsListRes = await db.query(`
      SELECT id, user_id, status, created_at, data 
      FROM recruitment_applications 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    const recentAppsList = recentAppsListRes.rows.map(app => {
        let name = 'Unknown';
        if (typeof app.data === 'object' && app.data !== null) {
             name = app.data.nome || app.data.name || app.data.discord_tag || 'Candidato';
        } else if (typeof app.data === 'string') {
            try {
                const parsed = JSON.parse(app.data);
                name = parsed.nome || parsed.name || parsed.discord_tag || 'Candidato';
            } catch (e) {}
        }
        return {
            id: app.id,
            name: name,
            status: app.status,
            created_at: app.created_at
        };
    });

    const servicesRes = await db.query(`
      SELECT DISTINCT ON (service_name) service_name, status, latency 
      FROM service_status_logs 
      ORDER BY service_name, created_at DESC
    `);
    const services = servicesRes.rows;

    const growthRes = await db.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(CASE WHEN action = 'join' THEN 1 ELSE 0 END) as joined,
        SUM(CASE WHEN action = 'leave' THEN 1 ELSE 0 END) as left
      FROM member_flow
      WHERE created_at > NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const growthStats = growthRes.rows;

    const activeRaffleDetailRes = await db.query("SELECT * FROM raffles WHERE status = 'active' ORDER BY created_at DESC LIMIT 1");
    const activeRaffleDetail = activeRaffleDetailRes.rows[0] || null;
    let raffleParticipants = 0;
    if (activeRaffleDetail) {
        const partRes = await db.query("SELECT COUNT(*) FROM raffle_participants WHERE raffle_id = $1", [activeRaffleDetail.id]);
        raffleParticipants = parseInt(partRes.rows[0].count);
    }

    res.json({
      stats: {
        totalMembers,
        pendingApps,
        activeRaffles,
        recentBans
      },
      recentApps: recentAppsList,
      services,
      growthStats,
      activeRaffle: activeRaffleDetail ? { 
        ...activeRaffleDetail, 
        participants: raffleParticipants,
        participant_limit: activeRaffleDetail.max_participants != null ? Number(activeRaffleDetail.max_participants) : null
      } : null
    });

  } catch (error) {
    console.error('[Dashboard] Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
