let serverDataByBot = new Map();

const setServerData = (botId, data) => {
  serverDataByBot.set(botId, {
    data,
    timestamp: Date.now()
  });
};

const getServerData = (botId) => {
  return serverDataByBot.get(botId)?.data || null;
};

const getAllServerData = () => {
  
  for (const [botId, entry] of serverDataByBot.entries()) {
    if (entry && entry.data) {
      return entry.data;
    }
  }
  
  console.warn('[botClientStore] Nenhum dado encontrado');
  return null;
};

const isBotConnected = () => {
  for (const [botId, entry] of serverDataByBot.entries()) {
    if (entry && entry.timestamp && (Date.now() - entry.timestamp) < 300000) {
      return true;
    }
  }
  return false;
};

const removeServerData = (botId) => {
  const deleted = serverDataByBot.delete(botId);
};

module.exports = {
  setServerData,
  getServerData,
  getAllServerData,
  isBotConnected,
  removeServerData
};
