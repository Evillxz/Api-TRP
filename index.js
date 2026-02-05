require('module-alias/register');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');
const chalk = require('chalk');

const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, envFile) });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const requireApiKey = require('./middleware/auth');
const logger = require('./utils/logger');
const db = require('./config/db');
const { startWs } = require('./wsServer');
const { formatUptime } = require('./utils/formatTime');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5500;
const server = http.createServer(app);

let requestCount = 0;

app.use((_req, _res, next) => {
  requestCount++;
  next();
});

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization', 'Cache-Control', 'Pragma', 'Expires']
}));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

morgan.token('custom-date', () => {
  const now = new Date();
  const pad = (num) => (num < 10 ? '0' + num : num);
  
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  
  return `${date} ${time}`;
});

morgan.token('status-colored', (_req, res) => {
  const status = res.statusCode;
  let color = 0;

  if (status >= 500) color = 31;
  else if (status >= 400) color = 33; 
  else if (status >= 300) color = 36; 
  else if (status >= 200) color = 32; 

  return `\x1b[${color}m${status}\x1b[0m`;
});

app.use(morgan(':custom-date [\x1b[32minfo\x1b[0m]: [:method] :url :status-colored - :response-time ms', {
  skip: (req, _res) => req.url.startsWith('/api/site/status')
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => {
    return req.url.includes('/site') || !!(req.headers['x-api-key'] || req.query.api_key); 
  }
});

app.use(limiter);

setInterval(() => {
  const memoriaTotalUsada = process.memoryUsage().rss / 1024 / 1024;
  const uptimeFormatado = formatUptime(process.uptime());

  logger.info(
    `${chalk.green.bold('[MONITORAMENTO]')} ` +
    `RAM: ${memoriaTotalUsada.toFixed(2)} MB | ` +
    `UPTIME: ${uptimeFormatado} | ` +
    `REQ (15m): ${requestCount}`
  );

  requestCount = 0;

}, 15 * 60 * 1000);

const authMiddleware = (req, res, next) => {
  if (req.method === 'OPTIONS') return next();

  if (req.path.startsWith('/site') || req.url.includes('/site')) {
    return next();
  }

  return requireApiKey(req, res, next);
};

app.use('/api', authMiddleware, routes);

(async () => {
  try {
    if (db && db.ensureTables) await db.ensureTables();

  } catch (err) {
    logger.error(`${chalk.red.bold('[DATABASE]')} Erro ao criar tabelas:`, err.message || err);
  }
})();

app.use((err, _req, res, _next) => {
  logger.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal_error' });
  }
});

try {
  startWs(server);
  logger.info(`${chalk.green('[WS SERVER]')} Servidor WS iniciado com sucesso!`);
} catch (err) {
  logger.error(`${chalk.red.bold('[WS SERVER]')} Erro ao iniciar o servidor WS:`, err.message);
}

const url = process.env.NODE_ENV === 'production' ? 'https://a-p-i-trindade.discloud.app' : 'http://localhost';

server.listen(PORT, () => {
  logger.info(`${chalk.hex('#42f59b').bold('[API SERVER]')} Api rodando em ${url}:${PORT}`);
});