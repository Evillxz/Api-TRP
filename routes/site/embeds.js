const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

module.exports = (wsManager) => {
  router.post('/send', async (req, res) => {
    try {
      const { channelId, content, embed } = req.body;

      // Validação de campos obrigatórios
      if (!channelId) {
        return res.status(400).json({ error: 'ID do canal é obrigatório' });
      }

      if (!content && !embed) {
        return res.status(400).json({ error: 'Conteúdo de mensagem ou embed é obrigatório' });
      }

      // Obter os clientes conectados via WebSocket
      const clients = wsManager.getClients();

      if (!clients || clients.size === 0) {
        return res.status(503).json({ error: 'Bot não está disponível no momento' });
      }

      // Obter o primeiro bot conectado
      const [botId, botInfo] = clients.entries().next().value;

      if (!botInfo || !botInfo.ws) {
        return res.status(503).json({ error: 'Conexão com o bot falhou' });
      }

      // Preparar a embed se fornecida
      const embedData = {};
      if (embed) {
        if (embed.title) embedData.title = embed.title;
        if (embed.description) embedData.description = embed.description;
        if (embed.url) embedData.url = embed.url;
        if (embed.color) embedData.color = parseInt(embed.color, 16);

        if (embed.author && embed.author.name) {
          embedData.author = {
            name: embed.author.name,
          };
          if (embed.author.icon_url) embedData.author.icon_url = embed.author.icon_url;
          if (embed.author.url) embedData.author.url = embed.author.url;
        }

        if (embed.thumbnail && embed.thumbnail.url) {
          embedData.thumbnail = { url: embed.thumbnail.url };
        }

        if (embed.image && embed.image.url) {
          embedData.image = { url: embed.image.url };
        }

        if (Array.isArray(embed.fields) && embed.fields.length > 0) {
          embedData.fields = embed.fields.map(field => ({
            name: field.name,
            value: field.value,
            inline: field.inline || false,
          }));
        }

        if (embed.footer && embed.footer.text) {
          embedData.footer = {
            text: embed.footer.text,
          };
          if (embed.footer.icon_url) embedData.footer.icon_url = embed.footer.icon_url;
        }

        if (embed.timestamp) {
          embedData.timestamp = new Date(embed.timestamp).toISOString();
        }
      }

      // Enviar requisição para o bot via WebSocket
      const requestId = uuidv4();
      const payload = {
        type: 'request',
        id: requestId,
        action: 'send_embed',
        payload: {
          channelId,
          content: content || undefined,
          embed: Object.keys(embedData).length > 0 ? embedData : undefined,
        },
      };

      // Promise que aguarda a resposta do bot
      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          wsManager.globalPending.delete(requestId);
          reject(new Error('Timeout ao aguardar resposta do bot'));
        }, 5000);

        wsManager.globalPending.set(requestId, { resolve, reject, timeout });
      });

      // Enviar para o bot
      botInfo.ws.send(JSON.stringify(payload));

      try {
        const result = await responsePromise;
        return res.status(200).json({
          message: 'Embed enviada com sucesso!',
          messageId: result.messageId,
          channelId: result.channelId,
        });
      } catch (error) {
        return res.status(500).json({
          error: error instanceof Error ? error.message : 'Erro ao enviar embed',
        });
      }
    } catch (error) {
      logger.error && logger.error('Erro ao processar envio de embed:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Erro interno do servidor',
      });
    }
  });

  return router;
};
