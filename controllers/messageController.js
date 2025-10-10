// controllers/messageController.js
// Comentários em pt-BR; identificadores em inglês.

const Message = require('../models/message');
const UserModel = require('../models/user');
const SectorModel = require('../models/sector');

function normalizeRecipientId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractRecipientInput(body = {}) {
  return {
    type: String(body.recipientType || body.recipient_type || '').trim().toLowerCase(),
    userId: normalizeRecipientId(
      body.recipientUserId ??
      body.recipient_user_id ??
      body.recipientId ??
      body.recipient_id
    ),
    sectorId: normalizeRecipientId(body.recipientSectorId ?? body.recipient_sector_id),
  };
}

async function resolveRecipientTarget({ type, userId, sectorId }) {
  const hasUser = Number.isInteger(userId) && userId > 0;
  const hasSector = Number.isInteger(sectorId) && sectorId > 0;

  if (hasUser && hasSector) {
    return { error: 'Escolha um único destinatário (usuário ou setor).' };
  }

  const wantsSector = type === 'setor' || type === 'sector' || type === 'sect' || type === 's' || type === 'grupo';
  const wantsUser = type === 'usuario' || type === 'user' || type === 'u' || type === 'pessoa';

  if ((hasSector && !wantsUser) || wantsSector) {
    if (!hasSector) {
      return { error: 'Informe o setor destinatário.' };
    }
    const sector = await SectorModel.getById(sectorId);
    if (!sector || sector.is_active !== true) {
      return { error: 'Setor inválido ou inativo.' };
    }
    return {
      recipient: sector.name,
      recipient_user_id: null,
      recipient_sector_id: sector.id,
      kind: 'sector',
    };
  }

  if (hasUser || wantsUser) {
    if (!hasUser) {
      return { error: 'Informe o usuário destinatário.' };
    }
    const user = await UserModel.findById(userId);
    const isActive = user && (user.is_active === true || user.is_active === 1 || user.is_active === '1');
    if (!user || !isActive) {
      return { error: 'Usuário destinatário inválido ou inativo.' };
    }
    return {
      recipient: user.name,
      recipient_user_id: user.id,
      recipient_sector_id: null,
      kind: 'user',
    };
  }

  if (hasSector) {
    const sector = await SectorModel.getById(sectorId);
    if (!sector || sector.is_active !== true) {
      return { error: 'Setor inválido ou inativo.' };
    }
    return {
      recipient: sector.name,
      recipient_user_id: null,
      recipient_sector_id: sector.id,
      kind: 'sector',
    };
  }

  return { error: 'Destinatário inválido.' };
}

function sanitizePayload(body = {}) {
  const payload = { ...body };
  delete payload.recipientId;
  delete payload.recipient_id;
  delete payload.recipientName;
  delete payload.recipient_name;
  delete payload.recipientUserId;
  delete payload.recipient_user_id;
  delete payload.recipientSectorId;
  delete payload.recipient_sector_id;
  delete payload.recipientType;
  delete payload.recipient_type;
  delete payload._csrf;
  return payload;
}

// Mapeia status -> rótulo pt-BR (mantém contrato do projeto)
const STATUS_LABELS_PT = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
};

function getViewerFromRequest(req) {
  const sessionUser = req.session?.user;
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    viewScope: sessionUser.viewScope || sessionUser.view_scope || 'all',
  };
}

// Função para padronizar o objeto enviado ao cliente (mantém snake_case e adiciona camelCase)
function toClient(row) {
  if (!row) return null;
  return {
    ...row,
    recipient_user_id: row.recipient_user_id ?? null,
    recipientUserId: row.recipient_user_id ?? null,
     recipient_sector_id: row.recipient_sector_id ?? null,
     recipientSectorId: row.recipient_sector_id ?? null,
     visibility: row.visibility ?? 'private',
    // alias em camelCase para compatibilidade com JS do front
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    // rótulo amigável
    status_label: STATUS_LABELS_PT[row.status] || row.status,
  };
}

// GET /api/messages?limit&offset&start_date&end_date&status&recipient&order_by&order
exports.list = async (req, res) => {
  try {
    const {
      limit,
      offset,
      start_date,
      end_date,
      status,
      recipient,
      order_by,
      order,
    } = req.query;

    const viewer = getViewerFromRequest(req);

    const rows = await Message.list({
      limit,
      offset,
      start_date,
      end_date,
      status,
      recipient,
      order_by,
      order,
      viewer,
    });

    return res.json({ success: true, data: rows.map(toClient) });
  } catch (err) {
    console.error('[messages] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar recados' });
  }
};

// GET /api/messages/:id
exports.getById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const viewer = getViewerFromRequest(req);
    const row = await Message.findById(id, { viewer });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }
    return res.json({ success: true, data: toClient(row) });
  } catch (err) {
    console.error('[messages] erro ao obter por id:', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter recado' });
  }
};

// POST /api/messages
exports.create = async (req, res) => {
  try {
    const recipientInput = extractRecipientInput(req.body);
    const resolved = await resolveRecipientTarget(recipientInput);
    if (resolved.error) {
      return res.status(400).json({ success: false, error: resolved.error });
    }

    const payload = sanitizePayload(req.body);
    payload.recipient = resolved.recipient;
    if (resolved.recipient_user_id !== undefined) {
      payload.recipient_user_id = resolved.recipient_user_id;
    } else {
      payload.recipient_user_id = null;
    }
    if (resolved.recipient_sector_id !== undefined) {
      payload.recipient_sector_id = resolved.recipient_sector_id;
    } else {
      payload.recipient_sector_id = null;
    }
    if (payload.visibility === undefined || payload.visibility === null || payload.visibility === '') {
      payload.visibility = 'private';
    }

    const id = await Message.create(payload);
    const created = await Message.findById(id);
    return res.status(201).json({ success: true, data: toClient(created) });
  } catch (err) {
    console.error('[messages] erro ao criar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao criar recado' });
  }
};

// PUT /api/messages/:id
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const payload = sanitizePayload(req.body);

    const recipientInput = extractRecipientInput(req.body);
    const shouldResolveRecipient = (
      recipientInput.userId ||
      recipientInput.sectorId ||
      recipientInput.type
    );

    if (shouldResolveRecipient) {
      const resolved = await resolveRecipientTarget(recipientInput);
      if (resolved.error) {
        return res.status(400).json({ success: false, error: resolved.error });
      }
      payload.recipient = resolved.recipient;
      if (resolved.recipient_user_id !== undefined) {
        payload.recipient_user_id = resolved.recipient_user_id;
      } else {
        payload.recipient_user_id = null;
      }
      if (resolved.recipient_sector_id !== undefined) {
        payload.recipient_sector_id = resolved.recipient_sector_id;
      } else {
        payload.recipient_sector_id = null;
      }
    }

    const ok = await Message.update(id, payload);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }
    const updated = await Message.findById(id);
    return res.json({ success: true, data: toClient(updated) });
  } catch (err) {
    console.error('[messages] erro ao atualizar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar recado' });
  }
};

// PATCH /api/messages/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const { status } = req.body || {};
    const ok = await Message.updateStatus(id, status);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }
    const updated = await Message.findById(id);
    return res.json({ success: true, data: toClient(updated) });
  } catch (err) {
    console.error('[messages] erro ao atualizar status:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar status' });
  }
};

// DELETE /api/messages/:id
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const ok = await Message.remove(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }
    return res.json({ success: true, data: 'Recado removido com sucesso' });
  } catch (err) {
    console.error('[messages] erro ao remover:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover recado' });
  }
};

// GET /api/messages/stats (cards do dashboard)
exports.stats = async (_req, res) => {
  try {
    const s = await Message.stats();
    return res.json({
      success: true,
      data: {
        ...s,
        labels: STATUS_LABELS_PT,
      },
    });
  } catch (err) {
    console.error('[messages] erro em /stats:', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter estatísticas' });
  }
};

// GET /api/stats/by-status (pizza)
exports.statsByStatus = async (_req, res) => {
  try {
    const rows = await Message.statsByStatus();
    return res.json({
      success: true,
      data: {
        labels: rows.map(r => STATUS_LABELS_PT[r.status] || r.status),
        data: rows.map(r => r.count),
      },
    });
  } catch (err) {
    console.error('[messages] erro em /stats/by-status:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por status.' });
  }
};

// GET /api/stats/by-recipient (barras)
exports.statsByRecipient = async (_req, res) => {
  try {
    const rows = await Message.statsByRecipient({ limit: 10 });
    return res.json({
      success: true,
      data: {
        labels: rows.map(r => r.recipient),
        data: rows.map(r => r.count),
      },
    });
  } catch (err) {
    console.error('[messages] erro em /stats/by-recipient:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por destinatário.' });
  }
};

// GET /api/stats/by-month (linha)
exports.statsByMonth = async (_req, res) => {
  try {
    const rows = await Message.statsByMonth();
    // formata MM/YYYY no controller (UI espera rótulo pt-BR)
    const labels = rows.map(r => {
      const [yy, mm] = r.month.split('-');
      return `${mm}/${yy}`;
    });
    return res.json({
      success: true,
      data: {
        labels,
        data: rows.map(r => r.count),
      },
    });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por mês:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por mês.' });
  }
};
