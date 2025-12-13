const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('./utils/logger');

const clients = new Map();

const pending = new Map();

function startWs(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    let authenticated = false;
    let botId = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (!authenticated) {
          if (msg.type === 'auth' && msg.apiKey && msg.apiKey === process.env.API_KEY) {
            authenticated = true;
            botId = msg.botId || `bot_${uuidv4()}`;
            clients.set(botId, { ws, info: { guilds: msg.guilds || [] } });
            logger.log && logger.log(`[WS] Bot connected: ${botId} guildsCount:${(msg.guilds||[]).length}`);
            try { logger.log && logger.log('[WS] connected bots:', Array.from(clients.keys())); } catch(e){}
            ws.send(JSON.stringify({ type: 'auth_ok', botId }));
            return;
          }
          ws.send(JSON.stringify({ type: 'auth_error' }));
          ws.close();
          return;
        }

        if (msg.type === 'response' && msg.id) {
          const waiter = pending.get(msg.id);
          if (waiter) {
            clearTimeout(waiter.timeout);
            pending.delete(msg.id);
            if (msg.status === 'ok') waiter.resolve(msg.data);
            else waiter.reject(new Error(msg.error || 'bot_error'));
          }
          return;
        }

        if (msg.type === 'event') {
          logger.log && logger.log('[WS event]', msg.event, msg.payload);
          return;
        }

      } catch (err) {
        logger.error && logger.error('[WS] message parse error', err && err.message ? err.message : err);
      }
    });

    ws.on('close', () => {
      if (botId) {
        clients.delete(botId);
        logger.log && logger.log(`[WS] Bot disconnected: ${botId}`);
      }
    });
  });

  logger.log && logger.log('[WS] WebSocket server started on path /ws');

  return {
    clients,
    sendRequestToBot(botId, action, payload, timeout = 5000) {
      const entry = clients.get(botId);
      if (!entry || !entry.ws || entry.ws.readyState !== WebSocket.OPEN) throw new Error('bot_unavailable');
      const id = uuidv4();
      const req = { type: 'request', id, action, payload };
      logger.log && logger.log('[WS] sendRequestToBot ->', { botId, id, action, payload });
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending.delete(id);
          reject(new Error('timeout'));
        }, timeout);
        pending.set(id, { resolve, reject, timeout: t });
        entry.ws.send(JSON.stringify(req));
      });
    }
  };
}

module.exports = { startWs };
