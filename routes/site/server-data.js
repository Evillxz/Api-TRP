const express = require('express');
const router = express.Router();
const { sendRequest } = require('../../wsServer');

const GUILD_ID = '1295702106195492894';

router.get('/roles', async (_req, res) => {
  try {
    const result = await sendRequest('get_guild_info', { guildId: GUILD_ID });
    
    const data = result.success ? result.data : {};
    res.json({ roles: data.roles || [] });
  } catch (error) {
    console.error('[Server Data] Error fetching roles:', error);
    res.status(500).json({ error: 'Falha ao buscar roles', roles: [] });
  }
});

router.get('/channels', async (_req, res) => {
  try {
    const result = await sendRequest('get_guild_info', { guildId: GUILD_ID });
    
    const data = result.success ? result.data : {};
    res.json({ channels: data.channels || [] });
  } catch (error) {
    console.error('[Server Data] Error fetching channels:', error);
    res.status(500).json({ error: 'Falha ao buscar canais', channels: [] });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const result = await sendRequest('get_guild_members', { 
      guildId: GUILD_ID,
      page: 1,
      limit: 600 
    });

    const members = (result.success && result.data) ? result.data.members : [];
    
    res.json({ users: members });
  } catch (error) {
    console.error('[Server Data] Error fetching users:', error);
    res.status(500).json({ error: 'Falha ao buscar usuários', users: [] });
  }
});

router.get('/emojis', async (_req, res) => {
  try {
    const result = await sendRequest('get_guild_info', { guildId: GUILD_ID });

    const data = result.success ? result.data : {};
    res.json({ emojis: data.emojis || [] });
  } catch (error) {
    console.error('[Server Data] Error fetching emojis:', error);
    res.status(500).json({ error: 'Falha ao buscar emojis', emojis: [] });
  }
});

router.get('/all', async (_req, res) => {
  try {
    const [infoResult, membersResult] = await Promise.all([
      sendRequest('get_guild_info', { guildId: GUILD_ID }),
      sendRequest('get_guild_members', { guildId: GUILD_ID, page: 1, limit: 600 })
    ]);

    const infoData = infoResult.success ? infoResult.data : {};
    const membersData = membersResult.success ? membersResult.data : {};

    const response = {
      roles: infoData.roles || [],
      channels: infoData.channels || [],
      users: membersData.members || [],
      emojis: infoData.emojis || [] 
    };

    res.json(response);
  } catch (error) {
    console.error('[Server Data] Error fetching all data:', error);
    res.status(500).json({ 
      error: 'Falha ao buscar dados do servidor',
      roles: [], channels: [], users: [], emojis: []
    });
  }
});

module.exports = router;