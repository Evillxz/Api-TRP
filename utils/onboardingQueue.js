const { REST, Routes } = require('discord.js');
const db = require('../config/db');

class OnboardingQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.GUILD_ID = '1295702106195492894';
    
    const token = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;
    if (!token) console.error('[OnboardingQueue] ERRO: Token não encontrado!');
    this.rest = new REST({ version: '10' }).setToken(token);
    
    this.ROLES_TO_ADD = [
      '1296584614391054428',
      '1446158406561042602'
    ];
  }

  add(application) {
    let data = application.data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch(e) { data = {}; }
    }

    // Base roles
    const rolesToAdd = [...this.ROLES_TO_ADD];

    // Shift roles mapping
    const shiftRoles = {
      'manha': '1447988476237709392',
      'tarde': '1447988532932120588',
      'noite': '1447988583217758318'
    };

    // Add shift roles if present
    if (data.turnos && Array.isArray(data.turnos)) {
      data.turnos.forEach(turno => {
        if (shiftRoles[turno]) {
          rolesToAdd.push(shiftRoles[turno]);
        }
      });
    }

    const item = {
      applicationId: application.id,
      userId: application.user_id,
      accessToken: application.access_token,
      nickname: `TRP » ${data.nomeJogo || 'Unknown'} [${data.identificacao || '***'}]`,
      roles: rolesToAdd,
      addedAt: Date.now(),
      data: data
    };

    this.queue.push(item);
    console.log(`[OnboardingQueue] Usuário ${item.userId} adicionado à fila. Posição: ${this.queue.length}`);
    
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const item = this.queue[0];

    try {
      console.log(`[OnboardingQueue] Processando ${item.userId}...`);

      let success = false;

      // 1. Tentar Adicionar via OAuth2 (Guild Join) - Isso já adiciona, seta nick e cargos
      if (item.accessToken) {
        try {
          console.log(`[OnboardingQueue] Tentando adicionar membro via Access Token...`);
          await this.rest.put(Routes.guildMember(this.GUILD_ID, item.userId), {
            body: {
              access_token: item.accessToken,
              nick: item.nickname,
              roles: item.roles
            }
          });
          console.log(`[OnboardingQueue] Sucesso ao adicionar/atualizar membro via Token.`);
          success = true;
        } catch (e) {
          console.error(`[OnboardingQueue] Falha ao usar Access Token:`, e.message);
        }
      }

      // Fallback: Se falhou (sem token ou erro), tenta atualizar manualmente se o membro já existir
      if (!success) {
        try {
          // Verificar se membro existe
          await this.rest.get(Routes.guildMember(this.GUILD_ID, item.userId));
          console.log(`[OnboardingQueue] Membro encontrado (Fallback). Atualizando manualmente...`);
          
          // Atualizar Apelido
          await this.rest.patch(Routes.guildMember(this.GUILD_ID, item.userId), {
            body: { nick: item.nickname }
          });
          
          // Adicionar Cargos
          for (const roleId of item.roles) {
            await this.rest.put(Routes.guildMemberRole(this.GUILD_ID, item.userId, roleId));
            await this.wait(1000);
          }
          console.log(`[OnboardingQueue] Atualização manual concluída.`);
          success = true;
        } catch (e) {
          console.error(`[OnboardingQueue] Membro não encontrado ou erro no fallback:`, e.message);
        }
      }

      if (success) {
        try {
            const shift = Array.isArray(item.data.turnos) ? item.data.turnos.join(', ') : (item.data.turnos || 'Não informado');
            
            await db.query(
                `INSERT INTO member_profile 
                (user_name, user_discord_tag, user_discord_nick, user_id, user_game_id, user_telephone, user_shift, rec_id, approver_id, approver_tag, approver_nick, guild_id, recruited_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                [
                    item.data.nomeJogo || 'Unknown',
                    'Unknown', // user_discord_tag
                    item.nickname,
                    item.userId,
                    item.data.identificacao || '0000',
                    item.data.telefone || '000-000',
                    shift,
                    String(item.applicationId),
                    'System', // approver_id
                    'System', // approver_tag
                    'System', // approver_nick
                    this.GUILD_ID,
                    new Date().toISOString()
                ]
            );
            console.log(`[OnboardingQueue] Perfil de membro criado no banco de dados.`);
        } catch (dbErr) {
            console.error(`[OnboardingQueue] Erro ao criar perfil de membro:`, dbErr);
        }
      }

      console.log(`[OnboardingQueue] Processo concluído para ${item.userId}`);

    } catch (error) {
      console.error(`[OnboardingQueue] Falha Geral:`, error.message);
    } finally {
      this.queue.shift();
      this.isProcessing = false;
      console.log(`[OnboardingQueue] Aguardando 15s para o próximo...`);
      await this.wait(15000);
      this.processQueue();
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new OnboardingQueue();