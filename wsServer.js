const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('logger');
const chalk = require('chalk');

const clients = new Map();
const pendingRequests = new Map();

function startWs(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    let isAuthenticated = false;
    let botId = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (!isAuthenticated) {
          if (msg.type === 'auth' && msg.apiKey === process.env.API_KEY) {
            isAuthenticated = true;
            botId = msg.botId || `bot_${uuidv4()}`;
            clients.set(botId, ws);
            
            ws.send(JSON.stringify({ type: 'auth_ok', botId }));
            logger.info(`${chalk.green('[WS SERVER]')} Bot conectado: ${botId}`);

          } else {
            ws.send(JSON.stringify({ type: 'auth_error' }));
            ws.close();
          }
          return;
        }

        if (msg.type === 'response' && msg.id) {
          const request = pendingRequests.get(msg.id);
          if (request) {
            clearTimeout(request.timeout);
            pendingRequests.delete(msg.id);
            if (msg.status === 'ok') {
              request.resolve(msg.data);
            } else {
              request.reject(new Error(msg.error || 'Erro desconhecido no bot'));
            }
          }
        }

      } catch (err) {
        logger.error(`${chalk.red.bold('[WS SERVER]')} Erro no parse: ${err.message}`);
      }
    });

    ws.on('close', () => {
      if (botId) {
        clients.delete(botId);
        logger.warn(`${chalk.yellow.bold('[WS SERVER]')} Bot desconectado: ${botId}`);
      }
    });
  });

  logger.info(`${chalk.green('[WS SERVER]')} WebSocket pronto em /ws`);
}

function sendRequest(action, payload = {}, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const botId = clients.keys().next().value;
    const ws = clients.get(botId);

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error('Nenhum bot conectado ao WebSocket.'));
    }

    const id = uuidv4();
    const request = { type: 'request', id, action, payload };

    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Timeout: O bot demorou muito para responder.'));
      }
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });

    ws.send(JSON.stringify(request));
  });
}

module.exports = { startWs, sendRequest };