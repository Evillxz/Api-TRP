const express = require('express');
const multer = require('multer');
const { Client, AttachmentBuilder } = require('discord.js');
const router = express.Router();
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file || !file.mimetype) {
      return cb(new Error('Arquivo inválido'));
    }
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são permitidas'));
    }
    cb(null, true);
  }

});

router.get('/', (_req, res) => {
  res.json({ status: 'Upload endpoint ready' });
});

router.post('/', upload.single('image'), async (req, res) => {
  let client = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const UPLOAD_CHANNEL_ID = process.env.DISCORD_UPLOAD_CHANNEL_ID;
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN_TEST;

    if (!UPLOAD_CHANNEL_ID) {
      return res.status(500).json({ error: 'Canal de upload não configurado' });
    }

    if (!DISCORD_BOT_TOKEN) {
      return res.status(500).json({ error: 'Token do bot não configurado' });
    }

    client = new Client({ 
      intents: ['Guilds', 'GuildMessages', 'MessageContent']
    });

    await client.login(DISCORD_BOT_TOKEN);
    const channel = await client.channels.fetch(UPLOAD_CHANNEL_ID);
    
    if (!channel) {
      return res.status(404).json({ error: 'Canal não encontrado' });
    }

    if (!channel.isTextBased()) {
      return res.status(400).json({ error: 'Canal não é um canal de texto' });
    }

    const attachment = new AttachmentBuilder(req.file.buffer, {
      name: req.file.originalname || 'image'
    });

    const message = await channel.send({
      files: [attachment],
      content: `📸 Upload - ${new Date().toLocaleString('pt-BR')}`
    });

    const imageUrl = message.attachments.first()?.url;
    if (!imageUrl) {
      return res.status(500).json({ error: 'Falha ao obter URL da imagem' });
    }

    res.json({ url: imageUrl });

  } catch (error) {
    res.status(500).json({ 
      error: error.message || 'Erro ao fazer upload'
    });

  } finally {
    if (client) {
      try {
        await client.destroy();
      } catch (err) {
      }
    }
  }
});

router.use((err, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Erro no upload: ' + err.message });
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;