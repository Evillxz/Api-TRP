const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const onboardingQueue = require('../../utils/onboardingQueue');
const { REST, Routes } = require('discord.js');

const GUILD_ID = '1295702106195492894';
const SPECIAL_ROLE_ID = '1456401070375964857';

router.get('/status', async (req, res) => {
  try {

    const userId = req.query.user_id;
    const cycleRes = await db.query('SELECT * FROM recruitment_cycles WHERE is_open = true AND id != 0 ORDER BY created_at DESC LIMIT 1');
    const currentCycle = cycleRes.rows[0];
    let userStatus = null;
    let isSpecial = false;

    if (userId) {
      const approvedRes = await db.query("SELECT * FROM recruitment_applications WHERE user_id = $1 AND status = 'APPROVED_PRACTICAL' LIMIT 1", [userId]);
      if (approvedRes.rows.length > 0) {
         userStatus = approvedRes.rows[0];
      } else {
          if (currentCycle) {
             const appRes = await db.query('SELECT * FROM recruitment_applications WHERE user_id = $1 AND cycle_id = $2', [userId, currentCycle.id]);
             if (appRes.rows.length > 0) {
                userStatus = appRes.rows[0];
             }
          } else {
             const appRes = await db.query('SELECT * FROM recruitment_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
             if (appRes.rows.length > 0) {
                userStatus = appRes.rows[0];
             }
          }
      }

      if (userStatus && typeof userStatus.data === 'string') {
          try { userStatus.data = JSON.parse(userStatus.data); } catch(e) {}
      }

      const botToken = process.env.DISCORD_BOT_TOKEN;
      if (botToken) {
        try {
          const rest = new REST({ version: '10' }).setToken(botToken);
          const member = await rest.get(Routes.guildMember(GUILD_ID, userId));
          if (member && member.roles && member.roles.includes(SPECIAL_ROLE_ID)) {
            isSpecial = true;
          }
        } catch (err) {
          console.error('[API] Erro ao verificar role especial:', err.message);
        }
      } else {
        console.warn('[API] BOT_TOKEN não configurado!');
      }
    }

    let slotsLeft = 0;
    if (currentCycle) {
      const countRes = await db.query("SELECT COUNT(*) FROM recruitment_applications WHERE cycle_id = $1 AND status != 'REJECTED_SOLICITATION' AND status != 'REJECTED_FORM' AND status != 'REJECTED_PRACTICAL'", [currentCycle.id]);
      const taken = parseInt(countRes.rows[0].count);
      slotsLeft = Math.max(0, currentCycle.slots - taken);
    }

    res.json({
      cycle: currentCycle || null,
      slotsLeft,
      userStatus,
      isSpecial
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit solicitation
router.post('/solicitation', async (req, res) => {
  const { userId, accessToken, nomeJogo, identificacao, telefone, nomeMembro, idMembro, turnos } = req.body;

  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const cycleRes = await db.query('SELECT * FROM recruitment_cycles WHERE is_open = true ORDER BY created_at DESC LIMIT 1');
    const currentCycle = cycleRes.rows[0];

    if (!currentCycle) {
      return res.status(400).json({ error: 'Recruitment is closed' });
    }

    const countRes = await db.query("SELECT COUNT(*) FROM recruitment_applications WHERE cycle_id = $1 AND status != 'REJECTED_SOLICITATION' AND status != 'REJECTED_FORM' AND status != 'REJECTED_PRACTICAL'", [currentCycle.id]);
    const taken = parseInt(countRes.rows[0].count);
    
    if (taken >= currentCycle.slots) {
      return res.status(400).json({ error: 'No slots available' });
    }

    const existingApp = await db.query('SELECT * FROM recruitment_applications WHERE user_id = $1 AND cycle_id = $2', [userId, currentCycle.id]);
    if (existingApp.rows.length > 0) {
      return res.status(400).json({ error: 'Already applied in this cycle' });
    }

    const appData = { nomeJogo, identificacao, telefone, nomeMembro, idMembro, turnos };
    const insertRes = await db.query(
      'INSERT INTO recruitment_applications (user_id, cycle_id, status, data, access_token) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [userId, currentCycle.id, 'PENDING_SOLICITATION', JSON.stringify(appData), accessToken]
    );
    const newApp = insertRes.rows[0];

    res.json({ success: true, application: newApp });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit quiz
router.post('/quiz', async (req, res) => {
  const { userId, answers } = req.body;

  if (!userId || !answers) return res.status(400).json({ error: 'Missing data' });

  try {
    const appRes = await db.query('SELECT * FROM recruitment_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
    const app = appRes.rows[0];

    if (!app) return res.status(404).json({ error: 'Application not found' });
    if (app.status !== 'PENDING_FORM') return res.status(400).json({ error: 'Invalid status for quiz submission' });

    let currentData = app.data;
    if (typeof currentData === 'string') {
        try { currentData = JSON.parse(currentData); } catch(e) { currentData = {}; }
    }
    const newData = { ...currentData, answers };
    const result = await db.query(
      'UPDATE recruitment_applications SET status = $1, data = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      ['SUBMITTED_FORM', JSON.stringify(newData), app.id]
    );

    res.json({ success: true, application: result.rows[0] });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- ADMIN ROUTES ---

// Open recruitment cycle
router.post('/cycle/open', async (req, res) => {
  const { slots } = req.body;
  if (!slots || slots < 1) return res.status(400).json({ error: 'Invalid slots number' });

  try {
    await db.query('UPDATE recruitment_cycles SET is_open = false, closed_at = NOW() WHERE is_open = true');

    const result = await db.query(
      'INSERT INTO recruitment_cycles (is_open, slots) VALUES (true, $1) RETURNING *',
      [slots]
    );
    
    res.json({ success: true, cycle: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Close recruitment cycle
router.post('/cycle/close', async (req, res) => {
  try {
    await db.query('UPDATE recruitment_cycles SET is_open = false, closed_at = NOW() WHERE is_open = true');
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/applications', async (req, res) => {
  try {
    const { all } = req.query;

    let query = `
      SELECT ra.*, rc.is_open as cycle_is_open 
      FROM recruitment_applications ra
      JOIN recruitment_cycles rc ON ra.cycle_id = rc.id
      WHERE ra.cycle_id != 0
    `;
    
    if (!all) {
      query += ` AND ra.cycle_id = (SELECT id FROM recruitment_cycles WHERE id != 0 ORDER BY created_at DESC LIMIT 1)`;
    }
    
    query += ` ORDER BY ra.created_at DESC`;

    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const cyclesRes = await db.query('SELECT * FROM recruitment_cycles WHERE is_open = false AND id != 0 ORDER BY created_at DESC');
    const cycles = cyclesRes.rows;

    const historyData = [];

    for (const cycle of cycles) {
      const appsRes = await db.query('SELECT * FROM recruitment_applications WHERE cycle_id = $1', [cycle.id]);
      const apps = appsRes.rows;

      const total = apps.length;
      const approved = apps.filter(app => app.status === 'APPROVED_PRACTICAL').length;
      const rejected = apps.filter(app => app.status.includes('REJECTED')).length;

      const candidates = apps.map(app => {
        let data = app.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch(e) { data = {}; }
        }

        return {
          id: app.id,
          name: data.nomeJogo || 'Desconhecido',
          discord_id: app.user_id,
          status: app.status,
          joined_at: app.created_at,
          original_status: app.status,
          data: data
        };
      });

      const isFullyClosed = candidates.every(c => 
        c.status === 'APPROVED_PRACTICAL' || c.status.includes('REJECTED')
      );

      historyData.push({
        id: cycle.id,
        opened_at: cycle.created_at,
        closed_at: cycle.closed_at || new Date().toISOString(),
        slots_offered: cycle.slots,
        is_fully_closed: isFullyClosed,
        stats: {
          total,
          approved,
          rejected
        },
        candidates
      });
    }

    res.json(historyData);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/application/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, scheduleDate } = req.body;
  
  const validStatuses = [
    'PENDING_SOLICITATION', 'APPROVED_SOLICITATION', 'REJECTED_SOLICITATION',
    'PENDING_FORM', 'SUBMITTED_FORM', 'APPROVED_FORM', 'REJECTED_FORM',
    'PENDING_INTERVIEW', 'APPROVED_INTERVIEW', 'REJECTED_INTERVIEW',
    'PENDING_PRACTICAL', 'APPROVED_PRACTICAL', 'REJECTED_PRACTICAL'
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    let query = 'UPDATE recruitment_applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *';
    let params = [status, id];

    if (scheduleDate) {
      const current = await db.query('SELECT data FROM recruitment_applications WHERE id = $1', [id]);
      if (current.rows.length > 0) {
        let currentData = current.rows[0].data;
        if (typeof currentData === 'string') {
            try { currentData = JSON.parse(currentData); } catch(e) { currentData = {}; }
        }
        const newData = { ...currentData, scheduleDate };
        
        query = 'UPDATE recruitment_applications SET status = $1, data = $2, updated_at = NOW() WHERE id = $3 RETURNING *';
        params = [status, JSON.stringify(newData), id];
      }
    }

    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = result.rows[0];

    if (status === 'APPROVED_PRACTICAL') {
      console.log(`[Recruitment] Iniciando onboarding para aplicação ${application.id} (User: ${application.user_id})`);
      onboardingQueue.add(application);
    }

    res.json({ success: true, application: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/application/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM recruitment_applications WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/legacy-profile', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' });
  
  const existingApp = await db.query('SELECT * FROM recruitment_applications WHERE user_id = $1 LIMIT 1', [user_id]);
  if (existingApp.rows.length > 0) {
      return res.json({ found: false, reason: 'ALREADY_REGISTERED' });
  }

  const OFFICIAL_ROLE_ID = '1296584614391054428';

  try {
    let legacyData = null;

    const result = await db.query('SELECT * FROM member_profile WHERE user_id = $1 LIMIT 1', [user_id]);
    
    if (result.rows.length > 0) {
      const profile = result.rows[0];
      
      let roleName = profile.user_shift;
      if (process.env.BOT_TOKEN) {
        try {
          const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
          const roles = await rest.get(Routes.guildRoles(GUILD_ID));
          const role = roles.find(r => r.id === profile.user_shift);
          if (role) {
            roleName = role.name;
          }
        } catch (err) {
          console.error('Error fetching roles from Discord:', err);
        }
      }

      legacyData = {
          user_name: profile.user_name,
          user_id: profile.user_id,
          user_game_id: profile.user_game_id,
          user_telephone: profile.user_telephone,
          user_shift: roleName,
          approver_nick: profile.approver_nick,
          approver_tag: profile.approver_tag
      };
    }

    const token = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;
    
    if (!legacyData && token) {
      try {
        const rest = new REST({ version: '10' }).setToken(token);
        
        console.log(`[Legacy Check] Checking Discord API for user: ${user_id}`);
        const member = await rest.get(Routes.guildMember(GUILD_ID, user_id));
        
        const hasRole = member.roles.includes(OFFICIAL_ROLE_ID);
        const joinedAt = new Date(member.joined_at);
        const now = new Date();
        const daysInServer = (now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);

        if (hasRole || daysInServer > 14) {
             legacyData = {
                user_name: member.nick || member.user.username,
                user_id: user_id,
                user_game_id: null,
                user_telephone: null,
                user_shift: null,
                approver_nick: 'Padrinho',
                approver_tag: 'SYSTEM'
            };
        }
      } catch (err) {
        console.error('[Legacy Check] Discord check failed:', err.message);
      }
    } else if (!token) {
        console.warn('[Legacy Check] No BOT_TOKEN found in environment variables.');
    }

    if (legacyData) {
      res.json({ found: true, profile: legacyData });
    } else {
      res.json({ found: false });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/legacy-apply', async (req, res) => {
    const { user_id, formData, accessToken } = req.body;
    const OFFICIAL_ROLE_ID = '1296584614391054428';

    let isAuthorized = false;

    const memberCheck = await db.query('SELECT * FROM member_profile WHERE user_id = $1 LIMIT 1', [user_id]);
    if (memberCheck.rows.length > 0) {
        isAuthorized = true;
    }

    const token = process.env.DISCORD_BOT_TOKEN || process.env.BOT_TOKEN;

    if (!isAuthorized && token) {
        try {
            const rest = new REST({ version: '10' }).setToken(token);
            const member = await rest.get(Routes.guildMember(GUILD_ID, user_id));
            const hasRole = member.roles.includes(OFFICIAL_ROLE_ID);
            const joinedAt = new Date(member.joined_at);
            const daysInServer = (new Date() - joinedAt) / (1000 * 60 * 60 * 24);
            
            if (hasRole && daysInServer > 14) {
                isAuthorized = true;
            }
        } catch (e) {
            console.error('Antiquity check failed on apply:', e);
        }
    }

    if (!isAuthorized) {
        return res.status(403).json({ error: 'User is not eligible for legacy migration.' });
    }

    const questionsAutoFilled = {
        nomePersonagem: "Usuário já é membro",
        idadePersonagem: "Usuário já é membro",
        historiaPersonagem: "Usuário já é membro",
        motivoEntrada: "Usuário já é membro",
        pg: "Usuário já é membro",
        mg: "Usuário já é membro",
        cl: "Usuário já é membro",
        rdmVdm: "Usuário já é membro",
        amorVida: "Usuário já é membro",
        crash: "Usuário já é membro",
        quizResult: "LEGACY_MEMBER",
        accessToken: accessToken || null
    };

    const fullData = {
        ...formData,
        ...questionsAutoFilled
    };

    function normalizeString(s) {
        if (s == null) return s;
        if (typeof s !== 'string') return s;
        return s
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim();
    }

    function normalizeObject(obj) {
        if (obj == null) return obj;
        if (Array.isArray(obj)) return obj.map(v => typeof v === 'string' ? normalizeString(v) : (typeof v === 'object' ? normalizeObject(v) : v));
        if (typeof obj === 'object') {
            const out = {};
            for (const k of Object.keys(obj)) {
                const val = obj[k];
                if (typeof val === 'string') out[k] = normalizeString(val);
                else if (Array.isArray(val)) out[k] = normalizeObject(val);
                else if (typeof val === 'object' && val !== null) out[k] = normalizeObject(val);
                else out[k] = val;
            }
            return out;
        }
        return obj;
    }

    const normalizedFullData = normalizeObject(fullData);

    try {
        await db.query(`
            INSERT INTO recruitment_cycles (id, is_open, slots, created_at, closed_at)
            VALUES (0, false, 0, '2000-01-01 00:00:00', '2000-01-01 00:00:00')
            ON CONFLICT (id) DO NOTHING
        `);

        const result = await db.query(
            `INSERT INTO recruitment_applications 
            (user_id, cycle_id, status, data, created_at, updated_at, access_token)
            VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
            RETURNING *`,
            [user_id, 0, 'APPROVED_PRACTICAL', JSON.stringify(normalizedFullData), accessToken]
        );
        
        res.json({ success: true, application: result.rows[0] });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Database Error' });
    }
});

module.exports = router;