const express = require('express');
const router = express.Router();
const botClientStore = require('../../utils/botClientStore');

let serverDataCache = {
  data: null,
  timestamp: 0,
  CACHE_DURATION: 25 * 1000
};

function invalidateCache() {
  serverDataCache.data = null;
  serverDataCache.timestamp = 0;
  console.log('[Server Data] Cache invalidated');
}

async function fetchServerData() {
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
  
  if (serverDataCache.data && (now - serverDataCache.timestamp) < serverDataCache.CACHE_DURATION) {
    return serverDataCache.data;
  }

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
module.exports.invalidateCache = invalidateCache;