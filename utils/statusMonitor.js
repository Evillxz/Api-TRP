const db = require('../config/db');
const { getClients, sendRequestToBot } = require('../wsServer');
const logger = require('./logger');

const SERVICES = [
  { id: 1, name: 'Core API' },
  { id: 2, name: 'PostgreSQL Database' },
  { id: 3, name: 'Discord Bot' },
  { id: 4, name: 'Lavalink Node' }
];

async function checkAndLogStatus() {
  const timestamp = new Date();
  const logs = [];

  logs.push({
    service_name: 'Core API',
    status: 'online',
    latency: 1
  });

  let dbStatus = 'offline';
  let dbLatency = 0;
  const dbStart = Date.now();
  try {
    await db.query('SELECT 1');
    dbStatus = 'online';
    dbLatency = Date.now() - dbStart;
  } catch (e) {
    logger.error('[StatusMonitor] DB Check failed:', e.message);
    dbStatus = 'offline';
  }
  logs.push({
    service_name: 'PostgreSQL Database',
    status: dbStatus,
    latency: dbLatency
  });

  const clients = getClients();
  let botStatus = 'offline';
  let botLatency = 0;
  let lavalinkStatus = 'offline';
  let lavalinkLatency = 0;

  if (clients.size > 0) {
    const botId = clients.keys().next().value;
    try {
      const start = Date.now();
      const statusData = await sendRequestToBot(botId, 'get_status', {}, 5000);
      const rtt = Date.now() - start;
      
      botStatus = 'online';
      botLatency = statusData.ping > -1 ? statusData.ping : rtt;

      if (statusData.lavalink && statusData.lavalink.length > 0) {
        const connectedNodes = statusData.lavalink.filter(n => n.state === 'CONNECTED' || n.state === 1);
        if (connectedNodes.length > 0) {
            lavalinkStatus = 'online';
            const pings = connectedNodes.map(n => n.ping).filter(p => p > -1);
            lavalinkLatency = pings.length > 0 ? Math.floor(pings.reduce((a, b) => a + b, 0) / pings.length) : 0;
            if (lavalinkLatency === 0) lavalinkLatency = 1;
        } else {
            lavalinkStatus = 'issue';
        }
      } else {
          lavalinkStatus = 'offline';
      }

    } catch (e) {
      logger.error('[StatusMonitor] Bot status check failed:', e.message);
      botStatus = 'issue';
    }
  }

  logs.push({
    service_name: 'Discord Bot',
    status: botStatus,
    latency: botLatency
  });

  logs.push({
    service_name: 'Lavalink Node',
    status: lavalinkStatus,
    latency: lavalinkLatency
  });

  for (const log of logs) {
    try {
      await db.query(
        'INSERT INTO service_status_logs (service_name, status, latency, created_at) VALUES ($1, $2, $3, $4)',
        [log.service_name, log.status, log.latency, timestamp]
      );
    } catch (err) {
      logger.error('[StatusMonitor] Error saving log:', err.message);
    }
  }
}

async function cleanupOldLogs() {
  try {
    await db.query("DELETE FROM service_status_logs WHERE created_at < NOW() - INTERVAL '30 days'");
  } catch (err) {
    logger.error('[StatusMonitor] Error cleaning up logs:', err.message);
  }
}

let monitorInterval;
let cleanupInterval;

function startMonitoring(intervalMs = 60000) {
  if (monitorInterval) clearInterval(monitorInterval);
  if (cleanupInterval) clearInterval(cleanupInterval);

  logger.info('[StatusMonitor] Starting service monitoring...');
  checkAndLogStatus();
  monitorInterval = setInterval(checkAndLogStatus, intervalMs);
  cleanupInterval = setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);
}

module.exports = { startMonitoring };