const express = require('express');
const router = express.Router();
const { sendRequest } = require('wsServer');

router.post('/send-v2', async (req, res) => {
  try {
    const { channelId, components, editLastMessage } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'ID do canal é obrigatório' });
    }
    if (!components || !Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: 'Lista de componentes é obrigatória' });
    }

    // --- FUNÇÃO DE FORMATAÇÃO RECURSIVA ---
    // Transforma o objeto do React no objeto limpo para o Bot
    const formatComponent = (block) => {
      // 1. CONTAINER
      if (block.type === 'container') {
        const containerData = {
          type: 'container',
          // Converte HEX (#ffffff) para INT (16777215)
          accent_color: block.accentColor ? parseInt(block.accentColor.replace('#', ''), 16) : null,
          // RECURSIVIDADE: Formata todos os filhos dentro deste container
          components: block.children ? block.children.map(formatComponent) : []
        };
        return containerData;
      }

      // 2. SEPARADOR
      if (block.type === 'separator') {
        return {
          type: 'separator',
          // O bot precisará converter 'small'/'large' para os enums corretos do Discord
          spacing: block.spacing || 'small', 
          has_divider: block.hasDivider
        };
      }

      // 3. IMAGEM (Media Gallery)
      if (block.type === 'image') {
        return {
          type: 'media_gallery',
          // O editor manda 'url', mas media gallery aceita array de imagens
          images: block.url ? [{ url: block.url }] : []
        };
      }

      // 4. TEXTO (Pode virar TextDisplay ou Section)
      if (block.type === 'text') {
        const hasThumbnail = !!block.thumbnail;
        const hasMultipleLines = block.content.length > 1;
        
        // Se tiver thumbnail OU múltiplas linhas, tratamos como SECTION para o bot
        if (hasThumbnail || hasMultipleLines) {
          return {
            type: 'section',
            thumbnail: block.thumbnail ? { url: block.thumbnail } : null,
            // Cada linha do array content vira um text_display dentro da section
            content: block.content.map(line => ({ type: 'text_display', content: line }))
          };
        } 
        
        // Se for texto simples (1 linha, sem thumb)
        return {
          type: 'text_display',
          content: block.content[0] || ''
        };
      }

      return null; // Caso venha lixo
    };

    // Processa a lista principal
    const finalComponents = components.map(formatComponent).filter(c => c !== null);

    // Payload para o WebSocket (Bot)
    const wsPayload = {
      channelId,
      components: finalComponents, // Array limpo
      editLastMessage,
      isV2: true // Flag para avisar o bot que deve usar MessageFlags.IsComponentsV2
    };

    // Envia para o bot (mesma lógica do embeds.js)
    const result = await sendRequest('send_components_v2', wsPayload);

    return res.status(200).json({
      success: result.success,
      code: result.code,
      message: result.message
    });

  } catch (error) {
    console.error('[API V2 Error]', error);
    const status = error.message && error.message.includes('Nenhum bot') ? 503 : 500;
    return res.status(status).json({ error: error.message || 'Erro interno na API' });
  }
});

module.exports = router;