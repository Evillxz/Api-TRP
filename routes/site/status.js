const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { getClients, sendRequestToBot } = require('../../wsServer');

async function getUptimeStats() {
  try {
    const result = await db.query(`
      SELECT 
        service_name, 
        count(*) as total, 
        count(*) filter (where status = 'online') as online_count 
      FROM service_status_logs 
      WHERE created_at > NOW() - INTERVAL '24 hours' 
      GROUP BY service_name
    `);
    
    const stats = {};
    result.rows.forEach(row => {
      const total = parseInt(row.total);
      const online = parseInt(row.online_count);
      stats[row.service_name] = total > 0 ? (online / total) * 100 : 100;
    });
    return stats;
  } catch (e) {
    console.error('Error fetching uptime stats:', e);
    return {};
  }
}

async function getHistoryStats() {
  try {
    // Agrupa por dia (data) e calcula a média de uptime de TODOS os serviços naquele dia
    const result = await db.query(`
      SELECT 
        DATE(created_at) as date,
        count(*) as total,
        count(*) filter (where status = 'online') as online_count
      FROM service_status_logs
      WHERE created_at > NOW() - INTERVAL '20 days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    return result.rows.map(row => ({
      date: row.date.toISOString().split('T')[0],
      uptime: row.total > 0 ? (parseInt(row.online_count) / parseInt(row.total)) * 100 : 100
    }));
  } catch (e) {
    console.error('Error fetching history stats:', e);
    return [];
  }
}

router.get('/history', async (req, res) => {
  const history = await getHistoryStats();
  res.json(history);
});

router.get('/', async (req, res) => {
  const startTotal = Date.now();
  
  const checkDb = async () => {
    const start = Date.now();
    try {
      await db.query('SELECT 1');
      const latency = Math.max(1, Date.now() - start);
      const sizeRes = await db.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
      const size = sizeRes.rows.length > 0 ? sizeRes.rows[0].size : 'N/A';
      return { status: 'online', latency, size };
    } catch (e) {
      return { status: 'offline', latency: 0, size: 'N/A' };
    }
  };

  const checkBot = async () => {
    const clients = getClients();
    if (clients.size === 0) return { botStatus: 'offline', botLatency: 0, botMemory: '0MB', lavalinkStatus: 'offline', lavalinkLatency: 0, lavalinkMemory: '0MB', lavalinkDescription: 'Servidor de Música' };

    const botId = clients.keys().next().value;
    try {
      const start = Date.now();
      const statusData = await sendRequestToBot(botId, 'get_status', {}, 3000);
      const rtt = Date.now() - start;
      
      const botStatus = 'online';
      const botLatency = statusData.ping > -1 ? statusData.ping : rtt;
      const botMemory = statusData.memory ? Math.round(statusData.memory / 1024 / 1024) + 'MB' : '0MB';

      let lavalinkStatus = 'offline';
      let lavalinkLatency = 0;
      let lavalinkMemory = '0MB';
      let lavalinkDescription = 'Servidor de Música';

      if (statusData.lavalink && statusData.lavalink.length > 0) {
        const connectedNodes = statusData.lavalink.filter(n => n.state === 'CONNECTED' || n.state === 1);
        
        if (connectedNodes.length > 0) {
            lavalinkStatus = 'online';
            lavalinkDescription = 'Servidor de Música';
            
            // Média de ping dos nós conectados
            const pings = connectedNodes.map(n => n.ping).filter(p => p > -1);
            lavalinkLatency = pings.length > 0 ? Math.floor(pings.reduce((a, b) => a + b, 0) / pings.length) : 0;
            if (lavalinkLatency === 0) lavalinkLatency = 1;
            
            const totalLavalinkMem = connectedNodes.reduce((acc, node) => {
                return acc + (node.stats && node.stats.memory ? node.stats.memory.used : 0);
            }, 0);
            lavalinkMemory = Math.round(totalLavalinkMem / 1024 / 1024) + 'MB';
        } else {
            lavalinkStatus = 'issue';
            if (statusData.lavalink[0]) {
                const state = statusData.lavalink[0].state;
                const stateMap = { 0: 'CONNECTING', 1: 'CONNECTED', 2: 'DISCONNECTING', 3: 'IDLE' };
                const stateStr = stateMap[state] || state;
                lavalinkDescription = `Status: ${stateStr}`;
            }
        }
      }

      return { botStatus, botLatency, botMemory, lavalinkStatus, lavalinkLatency, lavalinkMemory, lavalinkDescription };
    } catch (e) {
      return { botStatus: 'issue', botLatency: 0, botMemory: '0MB', lavalinkStatus: 'offline', lavalinkLatency: 0, lavalinkMemory: '0MB', lavalinkDescription: 'Servidor de Música' };
    }
  };

  // Executar tudo em paralelo
  const [uptimeStats, dbResult, botResult] = await Promise.all([
    getUptimeStats(),
    checkDb(),
    checkBot()
  ]);

  const getUptime = (name, currentStatus) => {
    if (uptimeStats[name] !== undefined) {
      return parseFloat(uptimeStats[name].toFixed(1));
    }
    return currentStatus === 'online' ? 100 : 0;
  };

  const services = [];

  // 1. Core API
  services.push({
    id: 1,
    name: 'Core API',
    description: 'Backend principal e rotas',
    status: 'online',
    latency: Math.max(1, Date.now() - startTotal), 
    uptime: getUptime('Core API', 'online'),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
  });

  // 2. PostgreSQL Database
  services.push({
    id: 2,
    name: 'PostgreSQL Database',
    description: 'Persistência de dados',
    status: dbResult.status,
    latency: dbResult.latency,
    uptime: getUptime('PostgreSQL Database', dbResult.status),
    memory: dbResult.size
  });

  // 3. Discord Bot
  services.push({
    id: 3,
    name: 'Discord Bot',
    description: 'Gateway e Eventos',
    status: botResult.botStatus,
    latency: botResult.botLatency,
    uptime: getUptime('Discord Bot', botResult.botStatus),
    memory: botResult.botMemory
  });

  // 4. Lavalink Node
  services.push({
    id: 4,
    name: 'Lavalink Node',
    description: botResult.lavalinkDescription,
    status: botResult.lavalinkStatus,
    latency: botResult.lavalinkLatency,
    uptime: getUptime('Lavalink Node', botResult.lavalinkStatus),
    memory: botResult.lavalinkMemory
  });

  res.json(services);
});

module.exports = router;
