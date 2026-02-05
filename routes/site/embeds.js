const express = require('express');
const router = express.Router();
const { sendRequest } = require('wsServer'); 

router.post('/send', async (req, res) => {
  try {
    const { channelId, content, embed, embeds, editLastMessage } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'ID do canal é obrigatório' });
    }
    if (!content && !embed && (!embeds || embeds.length === 0)) {
      return res.status(400).json({ error: 'Conteúdo ou Embed obrigatório' });
    }

    const formatEmbed = (emb) => {
      const embedData = {};
      if (emb.title) embedData.title = emb.title;
      if (emb.description) embedData.description = emb.description;
      if (emb.url) embedData.url = emb.url;
      if (emb.color) embedData.color = parseInt(emb.color, 16);
      if (emb.author) embedData.author = emb.author;
      if (emb.thumbnail?.url) embedData.thumbnail = { url: emb.thumbnail.url };
      if (emb.image?.url) embedData.image = { url: emb.image.url };
      if (emb.footer) embedData.footer = emb.footer;
      if (emb.timestamp) embedData.timestamp = new Date(emb.timestamp).toISOString();
      if (Array.isArray(emb.fields)) {
        embedData.fields = emb.fields.map(f => ({ name: f.name, value: f.value, inline: !!f.inline }));
      }
      
      return embedData;
    };

    let finalEmbeds = [];
    if (embeds && Array.isArray(embeds)) finalEmbeds = embeds.map(formatEmbed);
    else if (embed) finalEmbeds = [formatEmbed(embed)];

    const wsPayload = {
      channelId,
      content,
      embeds: finalEmbeds,
      editLastMessage
    };

    const result = await sendRequest('send_embed', wsPayload);

    return res.status(200).json({
      success: result.success,
      code: result.code,
      message: result.message
    });

  } catch (error) {
    logger.error(error);
    const status = error.message.includes('Nenhum bot') ? 503 : 500;
    return res.status(status).json({ error: error.message });
  }
});

module.exports = router;