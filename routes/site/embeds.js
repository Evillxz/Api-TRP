const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const logger = require('../../utils/logger');

module.exports = (wsManager) => {
  router.post('/send', async (req, res) => {
    try {
      const { channelId, content, embed, embeds, editLastMessage } = req.body;

      if (!channelId) {
        return res.status(400).json({ error: 'ID do canal é obrigatório' });
      }

      if (!content && !embed && (!embeds || embeds.length === 0)) {
        return res.status(400).json({ error: 'Conteúdo de mensagem ou embed é obrigatório' });
      }

      const clients = wsManager.getClients();

      if (!clients || clients.size === 0) {
        return res.status(503).json({ error: 'Bot não está disponível no momento' });
      }

      const [botId, botInfo] = clients.entries().next().value;

      if (!botInfo || !botInfo.ws) {
        return res.status(503).json({ error: 'Conexão com o bot falhou' });
      }

      const formatEmbed = (emb) => {
        const embedData = {};
        if (emb.title) embedData.title = emb.title;
        if (emb.description) embedData.description = emb.description;
        if (emb.url) embedData.url = emb.url;
        if (emb.color) embedData.color = parseInt(emb.color, 16);

        if (emb.author && emb.author.name) {
          embedData.author = { name: emb.author.name };
          if (emb.author.icon_url) embedData.author.icon_url = emb.author.icon_url;
          if (emb.author.url) embedData.author.url = emb.author.url;
        }

        if (emb.thumbnail && emb.thumbnail.url) embedData.thumbnail = { url: emb.thumbnail.url };
        if (emb.image && emb.image.url) embedData.image = { url: emb.image.url };

        if (Array.isArray(emb.fields) && emb.fields.length > 0) {
          embedData.fields = emb.fields.map(field => ({
            name: field.name,
            value: field.value,
            inline: field.inline || false,
          }));
        }

        if (emb.footer && emb.footer.text) {
          embedData.footer = { text: emb.footer.text };
          if (emb.footer.icon_url) embedData.footer.icon_url = emb.footer.icon_url;
        }

        if (emb.timestamp) embedData.timestamp = new Date(emb.timestamp).toISOString();
        
        return embedData;
      };

      let finalEmbeds = [];
      if (embeds && Array.isArray(embeds)) {
        finalEmbeds = embeds.map(formatEmbed);
      } else if (embed) {
        finalEmbeds = [formatEmbed(embed)];
      }

      const requestId = uuidv4();
      const payload = {
        type: 'request',
        id: requestId,
        action: 'send_embed',
        payload: {
          channelId,
          content: content || undefined,
          embeds: finalEmbeds.length > 0 ? finalEmbeds : undefined,
          editLastMessage: editLastMessage || false,
        },
      };

      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          wsManager.globalPending.delete(requestId);
          reject(new Error('Timeout ao aguardar resposta do bot'));
        }, 5000);

        wsManager.globalPending.set(requestId, { resolve, reject, timeout });
      });

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