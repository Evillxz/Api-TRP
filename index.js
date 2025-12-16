require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const requireApiKey = require('./middleware/auth');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5500;

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('tiny'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200
});
app.use(limiter);

app.get('/health', (req, res) => res.json({ ok: true }));

const uploadRoutes = require('./routes/site/upload');
app.use('/api/site/upload', (req, res, next) => {
  console.log(`[API] ${req.method} /api/site/upload`);
  next();
}, uploadRoutes);

const userStatusRoutes = require('./routes/bot/user_status');
app.use('/api/bot/user_status', userStatusRoutes);

const serviceRequestsRoutes = require('./routes/site/service_requests');
app.use('/api/site/service_requests', serviceRequestsRoutes);

const serverDataRoutes = require('./routes/site/server-data');
const botClientStore = require('./utils/botClientStore');
const embedsRoutes = require('./routes/site/embeds');

app.use('/api/site/server-data', serverDataRoutes);

// Placeholder para rotas de embeds - será preenchido após WebSocket estar pronto
let embedsRoutesHandler = null;
app.use('/api/site/embeds', (req, res, next) => {
  if (!embedsRoutesHandler) {
    return res.status(503).json({ error: 'WebSocket server not initialized' });
  }
  embedsRoutesHandler(req, res, next);
});

// Endpoint para registrar o bot client (chamado pelo bot quando fica ready)
app.post('/api/internal/register-bot', (req, res) => {
  const { botId, guildCount } = req.body;
  logger.info && logger.info(`[API Internal] Bot registrado: ${botId} com ${guildCount} guilds`);
  res.json({ status: 'ok', message: 'Bot client registered' });
});

const db = require('./config/db');
(async () => {
  try {
    if (db && db.ensureTables) await db.ensureTables();
  } catch (err) {
    logger.error && logger.error('Failed to ensure DB tables:', err.message || err);
    process.exit(1);
  }
  
  app.use('/api', requireApiKey, routes);
})();

app.use((err, req, res, next) => {
  logger.error && logger.error(err);
  res.status(500).json({ error: 'internal_error' });
});

const server = app.listen(PORT, () => {
  logger.log && logger.log(`[API] Api listening on https://a-p-i-trindade.discloud.app:${PORT}`);

  // Inicializar WebSocket APÓS o server estar pronto
  try {
    const { startWs } = require('./wsServer');
    const ws = startWs(server);
    
    // Agora que WebSocket está pronto, registrar o handler de embeds
    embedsRoutesHandler = embedsRoutes(ws);
    
    module.exports.ws = ws;
    logger.log && logger.log('[API] WebSocket server initialized');
  } catch (err) {
    logger.error && logger.error('Failed to start WS server:', err && err.message ? err.message : err);
  }
});
