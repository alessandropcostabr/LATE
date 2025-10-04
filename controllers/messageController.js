// controllers/messageController.js
// Comentários em pt-BR; identificadores em inglês.

const MessageModel = require('../models/message');

// Converte snake_case → camelCase para datas, preservando os campos originais.
function formatMessage(message) {
  if (!message) return null;
  return {
    ...message,
    status_label: MessageModel.STATUS_LABELS_PT?.[message.status] || message.status,
    createdAt: message.created_at ? new Date(message.created_at).toISOString() : null,
    updatedAt: message.updated_at ? new Date(message.updated_at).toISOString() : null,
  };
}

// Utilitário para montar payload de gráficos (labels/data) com fallback seguro.
function toChartPayload(rows, { labelKey, valueKey, fallbackLabel = 'Não informado', transformLabel } = {}) {
  const labels = [];
  const data = [];

  for (const row of rows || []) {
    const rawLabel = labelKey ? row[labelKey] : row;
    const baseLabel = (rawLabel === undefined || rawLabel === null || rawLabel === '')
      ? fallbackLabel
      : rawLabel;
    const finalLabel = transformLabel ? transformLabel(baseLabel, row) : baseLabel;

    const rawValue = valueKey ? row[valueKey] : row;
    const numericValue = Number(rawValue);
    const finalValue = Number.isFinite(numericValue) ? numericValue : 0;

    labels.push(String(finalLabel));
    data.push(finalValue);
  }

  return { labels, data };
}

function formatMonthLabel(label) {
  if (!label || typeof label !== 'string') return 'Não informado';
  const parts = label.split('-'); // 'YYYY-MM'
  if (parts.length === 2) {
    const [year, month] = parts;
    return `${month}/${year}`;
  }
  return label;
}

// ---------------------------------------------------------------------------
// Listagem
// Retorna também `items[]` e `meta` para compatibilidade com o front.
// ---------------------------------------------------------------------------
exports.list = async (req, res) => {
  try {
    const q = req.query || {};

    // Defaults defensivos
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 10, 1), 50);
    const offset = Math.max(parseInt(q.offset, 10) || 0, 0);

    const filters = {
      status: q.status || null,
      recipient: q.recipient || null,
      q: q.q || null,
      start_date: q.start_date || null,
      end_date: q.end_date || null,
      order_by: q.order_by || 'created_at',
      order: (q.order || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc',
      limit,
      offset,
    };

    // O model pode retornar array puro ou { items, total }
    const rowsOrObj = await MessageModel.list(filters);
    const rawItems = Array.isArray(rowsOrObj) ? rowsOrObj : (rowsOrObj.items || []);
    const total = Array.isArray(rowsOrObj) ? rawItems.length : (rowsOrObj.total ?? rawItems.length);

    const items = rawItems.map(formatMessage);

    return res.json({
      success: true,
      data: items,             // legado (alguns pontos do front ainda leem 'data' diretamente)
      items,                   // formato novo e explícito
      meta: { total, limit, offset }
    });
  } catch (err) {
    console.error('[messages] list error:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar recados' });
  }
};

// ---------------------------------------------------------------------------
// Obter por ID
// ---------------------------------------------------------------------------
exports.getById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    // Alguns repos têm findById; outros getById — mantemos findById que já era usado aqui
    const message = await MessageModel.findById ? MessageModel.findById(id) : MessageModel.getById(id);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada.' });
    }
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao obter mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter mensagem.' });
  }
};

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------
exports.create = async (req, res) => {
  try {
    const id = await MessageModel.create(req.body || {});
    const message = id
      ? (MessageModel.findById ? await MessageModel.findById(id) : await MessageModel.getById(id))
      : null;
    const formatted = message ? formatMessage(message) : { id };
    return res.status(201).json({ success: true, data: formatted });
  } catch (err) {
    console.error('[messages] erro ao criar mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar mensagem.' });
  }
};

// ---------------------------------------------------------------------------
// Atualizar
// ---------------------------------------------------------------------------
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ok = await MessageModel.update(id, req.body || {});
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para atualização.' });
    }
    const message = MessageModel.findById ? await MessageModel.findById(id) : await MessageModel.getById(id);
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao atualizar mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar mensagem.' });
  }
};

// ---------------------------------------------------------------------------
// Atualizar status
// ---------------------------------------------------------------------------
exports.updateStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body && req.body.status;
    const ok = await MessageModel.updateStatus(id, status);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para atualização de status.' });
    }
    const message = MessageModel.findById ? await MessageModel.findById(id) : await MessageModel.getById(id);
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao atualizar status:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar status da mensagem.' });
  }
};

// ---------------------------------------------------------------------------
// Remover
// ---------------------------------------------------------------------------
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ok = await MessageModel.remove(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para exclusão.' });
    }
    return res.json({ success: true, data: { id, deleted: true } });
  } catch (err) {
    console.error('[messages] erro ao excluir mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir mensagem.' });
  }
};

// ---------------------------------------------------------------------------
// Estatísticas (cards/dashboard)
// ---------------------------------------------------------------------------
exports.stats = async (_req, res) => {
  try {
    const stats = await MessageModel.stats();
    return res.json({
      success: true,
      data: {
        ...stats,
        labels: MessageModel.STATUS_LABELS_PT || {
          pending: 'Pendente',
          in_progress: 'Em andamento',
          resolved: 'Resolvido'
        }
      }
    });
  } catch (err) {
    console.error('[messages] erro nas estatísticas:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas.' });
  }
};

// ---------------------------------------------------------------------------
// Estatísticas por destinatário
// ---------------------------------------------------------------------------
exports.statsByRecipient = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const rows = await MessageModel.statsByRecipient({ limit });
    const payload = toChartPayload(rows, {
      labelKey: 'recipient',
      valueKey: 'count',
      fallbackLabel: 'Não informado'
    });
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por destinatário:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por destinatário.' });
  }
};

// ---------------------------------------------------------------------------
// Estatísticas por status
// ---------------------------------------------------------------------------
exports.statsByStatus = async (_req, res) => {
  try {
    const rows = await MessageModel.statsByStatus();
    const payload = toChartPayload(rows, {
      labelKey: 'label',
      valueKey: 'count',
      fallbackLabel: 'Status desconhecido'
    });
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por status:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por status.' });
  }
};

// ---------------------------------------------------------------------------
// Estatísticas por mês
// ---------------------------------------------------------------------------
exports.statsByMonth = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const rows = await MessageModel.statsByMonth({ limit }); // ok se o model ignorar params
    const payload = toChartPayload(rows, {
      labelKey: 'month',
      valueKey: 'count',
      fallbackLabel: 'Não informado',
      transformLabel: formatMonthLabel
    });
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por mês:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por mês.' });
  }
};

