const path = require('path');
const dotenv = require('dotenv');

const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.development';

dotenv.config({ path: path.resolve(__dirname, envFile) });
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
app.use('/uploads', express.static('uploads'));
app.use(morgan('tiny', {
  skip: (req, res) => req.url.startsWith('/api/site/status')
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    return apiKey === process.env.API_KEY;
  }
});
app.use(limiter);

const db = require('./config/db');
const botClientStore = require('./utils/botClientStore');

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', routes);

const uploadRoutes = require('./routes/site/upload');
app.use('/api/site/upload', (req, res, next) => {
  console.log(`[API] ${req.method} /api/site/upload`);
  next();
}, uploadRoutes);

const userStatusRoutes = require('./routes/bot/user_status');
app.use('/api/bot/user_status', userStatusRoutes);

const memberFlowRoutes = require('./routes/bot/member_flow');
app.use('/api/bot/member_flow', memberFlowRoutes);

const dashboardRoutes = require('./routes/site/dashboard');
app.use('/api/site/dashboard', dashboardRoutes);


const moderationRoutes = require('./routes/site/moderation');
app.use('/api/site/moderation', moderationRoutes);

const serverDataRoutes = require('./routes/site/server-data');
const statusRoutes = require('./routes/site/status');
const embedsRoutes = require('./routes/site/embeds');
const recruitmentRoutes = require('./routes/site/recruitment');

app.use('/api/site/server-data', serverDataRoutes);
app.use('/api/site/status', statusRoutes);
app.use('/api/site/recruitment', recruitmentRoutes);

let embedsRoutesHandler = null;
app.use('/api/site/embeds', (req, res, next) => {
  if (!embedsRoutesHandler) {
    return res.status(503).json({ error: 'WebSocket server not initialized' });
  }
  embedsRoutesHandler(req, res, next);
});

app.post('/api/internal/register-bot', (req, res) => {
  const { botId, guildCount } = req.body;
  logger.info && logger.info(`[API Internal] Bot registrado: ${botId} com ${guildCount} guilds`);
  botClientStore.setServerData(botId, { guildCount, registered: true });
  res.json({ status: 'ok', message: 'Bot client registered' });
});

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

const url = process.env.NODE_ENV === 'production' 
  ? 'https://a-p-i-trindade.discloud.app' 
  : 'http://localhost';

const server = app.listen(PORT, () => {
  logger.log && logger.log(`[API] Api listening on ${url}:${PORT}`);

  try {
    const { startWs } = require('./wsServer');
    const ws = startWs(server);
    embedsRoutesHandler = embedsRoutes(ws);
    
    module.exports.ws = ws;
    logger.log && logger.log('[API] WebSocket server initialized');

    const { startMonitoring } = require('./utils/statusMonitor');
    startMonitoring(5 * 60 * 1000); 

  } catch (err) {
    logger.error && logger.error('Failed to start WS server:', err && err.message ? err.message : err);
  }
});