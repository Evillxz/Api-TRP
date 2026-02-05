const express = require('express');
const router = express.Router();
const db = require('db');
const { sendRequest } = require('wsServer');

const GUILD_ID = '1295702106195492894';

router.get('/', async (_req, res) => {
  try {

    const [
      guildInfoResult,
      pendingAppsRes,
      activeRafflesRes,
      recentBansRes,
      recentAppsListRes,
      growthRes,
      activeRaffleDetailRes,
      servicesRes
    ] = await Promise.all([
      
      sendRequest('get_guild_info', { guildId: GUILD_ID }).catch(_err => ({ success: false })),

      // Estatísticas do Banco de Dados
      db.query("SELECT COUNT(*) FROM recruitment_applications WHERE status NOT LIKE 'REJECTED%' AND status != 'APPROVED_PRACTICAL'"),
      db.query("SELECT COUNT(*) FROM raffles WHERE status = 'active'"),
      db.query("SELECT COUNT(*) FROM bans WHERE created_at > NOW() - INTERVAL '24 hours'"),
      
      // Listas Recentes
      db.query(`
        SELECT id, user_id, status, created_at, data 
        FROM recruitment_applications 
        ORDER BY created_at DESC LIMIT 3
      `),
      
      // Gráfico de Fluxo de Membros
      db.query(`
        SELECT DATE(created_at) as date,
        SUM(CASE WHEN action = 'join' THEN 1 ELSE 0 END) as joined,
        SUM(CASE WHEN action = 'leave' THEN 1 ELSE 0 END) as left
        FROM member_flow
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),

      // Sorteio Ativo (Detalhes)
      db.query("SELECT * FROM raffles WHERE status = 'active' ORDER BY created_at DESC LIMIT 1"),

      // Serviços (Proteção caso a tabela não exista ou query falhe)
      db.query("SELECT * FROM services ORDER BY id DESC LIMIT 5").catch(() => ({ rows: [] }))
    ]);

    const totalMembers = (guildInfoResult.success && guildInfoResult.data) 
      ? guildInfoResult.data.memberCount 
      : 0;

    const pendingApps = parseInt(pendingAppsRes.rows[0].count);
    const activeRaffles = parseInt(activeRafflesRes.rows[0].count);
    const recentBans = parseInt(recentBansRes.rows[0].count);

    const recentAppsList = recentAppsListRes.rows.map(app => {
        let name = 'Desconhecido';

        if (app.data && typeof app.data === 'object') {
             name = app.data.nome || app.data.name || app.data.discord || 'Usuário';
        }

        return {
            id: app.id,
            user_id: app.user_id,
            status: app.status,
            created_at: app.created_at,
            name: name
        };
    });

    let activeRaffleData = null;
    if (activeRaffleDetailRes.rows.length > 0) {
        const raffle = activeRaffleDetailRes.rows[0];

        const partRes = await db.query("SELECT COUNT(*) FROM raffle_participants WHERE raffle_id = $1", [raffle.id]);
        
        activeRaffleData = { 
            ...raffle, 
            participants: parseInt(partRes.rows[0].count),
            participant_limit: raffle.max_participants != null ? Number(raffle.max_participants) : null
        };
    }

    res.json({
      stats: {
        totalMembers,
        pendingApps,
        activeRaffles,
        recentBans
      },
      recentApps: recentAppsList,
      services: servicesRes.rows || [],
      growthStats: growthRes.rows,
      activeRaffle: activeRaffleData
    });

  } catch (error) {
    console.error('[Dashboard] Erro ao carregar dados:', error);
    res.status(500).json({ error: 'Erro interno ao carregar dashboard.' });
  }
});

module.exports = router;