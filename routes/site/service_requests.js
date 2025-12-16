const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/1449810350852538448/AYoBPeYZ8aUiYxACibat0zFT-sY3Bf_-m1SGF_JxZQNIiK3yLMhjfEepMFtDEFKhGf-R';

async function enviarParaDiscord(dados) {

  let color = 10181046;
  if(dados.serviceId === 'assassinato') color = 15548997;
  if(dados.serviceId === 'armas') color = 15105570;
  if(dados.serviceId === 'drogas') color = 5763719;

  const embed = {
    username: "Service System - Sistema de Serviços",
    avatar_url: "https://i.imgur.com/aD0Bcgk.png",
    embeds: [
      {
        title: "🔔 Nova Solicitação de Serviço",
        description: `Um novo pedido foi registrado no sistema.`,
        color: color,
        fields: [
          {
            name: "👤 Solicitante",
            value: `\`${dados.user}\``,
            inline: true
          },
          {
            name: "📦 Tipo de Serviço",
            value: `**${dados.serviceName.toUpperCase()}**`,
            inline: true
          },
          {
            name: "📝 Detalhes da Operação",
            value: `>>> ${dados.details}`
          },
          {
            name: "🆔 ID do Usuário (Game)",
            value: dados.gameId || "Não informado",
            inline: true
          },
          {
            name: "📅 Data",
            value: `<t:${Math.floor(Date.now() / 1000)}:f>`,
            inline: true
          }
        ],
        footer: {
          text: "Máfia Trindade Penumbra • Painel de Controle",
          icon_url: "https://i.imgur.com/aD0Bcgk.png"
        },
        thumbnail: {
           url: "https://i.imgur.com/aD0Bcgk.png"
        }
      }
    ]
  };

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(embed)
  });

  if (!response.ok) {
    throw new Error(`Erro ao enviar para Discord: ${response.status}`);
  }
}

router.post('/', async (req, res) => {
  try {
    const { serviceId, serviceName, details, user, gameId } = req.body;

    if (!serviceId || !serviceName || !details || !user) {
      return res.status(400).json({ error: 'Campos obrigatórios: serviceId, serviceName, details, user' });
    }

    await enviarParaDiscord({ serviceId, serviceName, details, user, gameId });

    logger.info(`Solicitação de serviço enviada: ${serviceName} por ${user}`);

    res.json({ success: true, message: 'Solicitação enviada com sucesso!' });
  } catch (error) {
    logger.error('Erro ao processar solicitação de serviço:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;