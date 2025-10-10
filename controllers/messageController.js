// controllers/messageController.js
// Comentários em pt-BR; identificadores em inglês.

const Message = require('../models/message');
const UserModel = require('../models/user');

function normalizeRecipientId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function resolveRecipient(recipientId) {
  const id = normalizeRecipientId(recipientId);
  if (!id) return null;

  const user = await UserModel.findById(id);
  if (!user || user.is_active !== true) return null;
  return { id: user.id, name: user.name };
}

function sanitizePayload(body = {}) {
  const payload = { ...body };
  delete payload.recipientId;
  delete payload.recipient_id;
  delete payload.recipientName;
  delete payload.recipient_name;
  delete payload.recipientUserId;
  delete payload.recipient_user_id;
  delete payload._csrf;
  return payload;
}

// Mapeia status -> rótulo pt-BR (mantém contrato do projeto)
const STATUS_LABELS_PT = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
};

// Função para padronizar o objeto enviado ao cliente (mantém snake_case e adiciona camelCase)
function toClient(row) {
  if (!row) return null;
  return {
    ...row,
    recipient_user_id: row.recipient_user_id ?? null,
    recipientUserId: row.recipient_user_id ?? null,
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

    const rows = await Message.list({
      limit,
      offset,
      start_date,
      end_date,
      status,
      recipient,
      order_by,
      order,
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
    const row = await Message.findById(id);
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
    const recipient = await resolveRecipient(
      req.body?.recipientId ??
      req.body?.recipient_id ??
      req.body?.recipientUserId ??
      req.body?.recipient_user_id
    );
    if (!recipient) {
      return res.status(400).json({ success: false, error: 'Destinatário inválido' });
    }

    const payload = sanitizePayload(req.body);
    payload.recipient = recipient.name;
    payload.recipient_user_id = recipient.id;

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
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'recipientId') ||
        Object.prototype.hasOwnProperty.call(req.body || {}, 'recipient_id') ||
        Object.prototype.hasOwnProperty.call(req.body || {}, 'recipientUserId') ||
        Object.prototype.hasOwnProperty.call(req.body || {}, 'recipient_user_id')) {
      const recipient = await resolveRecipient(
        req.body?.recipientId ??
        req.body?.recipient_id ??
        req.body?.recipientUserId ??
        req.body?.recipient_user_id
      );
      if (!recipient) {
        return res.status(400).json({ success: false, error: 'Destinatário inválido' });
      }
      payload.recipient = recipient.name;
      payload.recipient_user_id = recipient.id;
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

