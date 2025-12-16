const express = require('express');
const router = express.Router();
const botClientStore = require('../../utils/botClientStore');

// Dados em cache para evitar muitas chamadas ao Discord
let serverDataCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutos
};

const GUILD_ID = process.env.GUILD_ID || '1295702106195492894';

// Função para buscar dados do servidor
async function fetchServerData() {
  // Tenta obter dados já enviados pelo bot via WebSocket
  const botData = botClientStore.getAllServerData();
  if (botData) {
    console.log('[Server Data] Usando dados do bot via WebSocket');
    return botData;
  }

  console.warn('[Server Data] Dados do bot não disponível via WebSocket');
  return null;
}

async function getOrFetchServerData() {
  const now = Date.now();
  
  // Se temos cache válido, retorna
  if (serverDataCache.data && (now - serverDataCache.timestamp) < serverDataCache.CACHE_DURATION) {
    return serverDataCache.data;
  }

  // Caso contrário, busca dados frescos
  const data = await fetchServerData();
  if (data) {
    serverDataCache.data = data;
    serverDataCache.timestamp = now;
  }

  return data || { roles: [], users: [], channels: [], emojis: [] };
}

router.get('/roles', async (req, res) => {
  try {
    const data = await getOrFetchServerData();
    res.json({ roles: data.roles || [] });
  } catch (error) {
    console.error('[Server Data] Error fetching roles:', error);
    res.status(500).json({ error: 'Falha ao buscar roles' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const data = await getOrFetchServerData();
    res.json({ users: data.users || [] });
  } catch (error) {
    console.error('[Server Data] Error fetching users:', error);
    res.status(500).json({ error: 'Falha ao buscar usuários' });
  }
});

router.get('/channels', async (req, res) => {
  try {
    const data = await getOrFetchServerData();
    res.json({ channels: data.channels || [] });
  } catch (error) {
    console.error('[Server Data] Error fetching channels:', error);
    res.status(500).json({ error: 'Falha ao buscar canais' });
  }
});

router.get('/emojis', async (req, res) => {
  try {
    const data = await getOrFetchServerData();
    res.json({ emojis: data.emojis || [] });
  } catch (error) {
    console.error('[Server Data] Error fetching emojis:', error);
    res.status(500).json({ error: 'Falha ao buscar emojis' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const data = await getOrFetchServerData();
    res.json(data);
  } catch (error) {
    console.error('[Server Data] Error fetching all data:', error);
    res.status(500).json({ error: 'Falha ao buscar dados do servidor' });
  }
});

module.exports = router;
