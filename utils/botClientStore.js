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
  return null;
};

module.exports = {
  setServerData,
  getServerData,
  getAllServerData
};
