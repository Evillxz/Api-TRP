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
});

try {
  const { startWs } = require('./wsServer');
  const ws = startWs(server);
  module.exports.ws = ws;
} catch (err) {
  logger.error && logger.error('Failed to start WS server:', err && err.message ? err.message : err);
}
