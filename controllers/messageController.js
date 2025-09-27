const MessageModel = require('../models/message');

function formatMessage(message) {
  if (!message) return null;
  return {
    ...message,
    status_label: MessageModel.STATUS_LABELS_PT[message.status] || message.status,
  };
}

function toChartPayload(rows, { labelKey, valueKey, fallbackLabel = 'Não informado', transformLabel } = {}) {
  const labels = [];
  const data = [];

  for (const row of rows || []) {
    const rawLabel = labelKey ? row[labelKey] : row;
    const baseLabel = rawLabel === undefined || rawLabel === null || rawLabel === '' ? fallbackLabel : rawLabel;
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
  if (!label || typeof label !== 'string') {
    return 'Não informado';
  }

  const [year, month] = label.split('-');
  if (year && month) {
    return `${month}/${year}`;
  }

  return label;
}

exports.list = async (req, res) => {
  try {
    const { limit, offset, status, start_date, end_date, recipient } = req.query || {};
    const messages = (await MessageModel.list({ limit, offset, status, start_date, end_date, recipient })).map(formatMessage);
    return res.json({ success: true, data: messages });
  } catch (err) {
    console.error('[messages] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar mensagens.' });
  }
};

exports.getById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const message = await MessageModel.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada.' });
    }
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao obter mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter mensagem.' });
  }
};

exports.create = async (req, res) => {
  try {
    const id = await MessageModel.create(req.body || {});
    const message = id ? await MessageModel.findById(id) : null;
    const formatted = message ? formatMessage(message) : { id };
    return res.status(201).json({ success: true, data: formatted });
  } catch (err) {
    console.error('[messages] erro ao criar mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar mensagem.' });
  }
};

exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await MessageModel.update(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para atualização.' });
    }
    const message = await MessageModel.findById(id);
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao atualizar mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar mensagem.' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    const updated = await MessageModel.updateStatus(id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para atualização de status.' });
    }
    const message = await MessageModel.findById(id);
    return res.json({ success: true, data: formatMessage(message) });
  } catch (err) {
    console.error('[messages] erro ao atualizar status:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar status da mensagem.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const removed = await MessageModel.remove(id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Mensagem não encontrada para exclusão.' });
    }
    return res.json({ success: true, data: { id, deleted: true } });
  } catch (err) {
    console.error('[messages] erro ao excluir mensagem:', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir mensagem.' });
  }
};

exports.stats = async (_req, res) => {
  try {
    const stats = await MessageModel.stats();
    return res.json({
      success: true,
      data: {
        ...stats,
        labels: MessageModel.STATUS_LABELS_PT,
      },
    });
  } catch (err) {
    console.error('[messages] erro nas estatísticas:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas.' });
  }
};

exports.statsByRecipient = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const rows = await MessageModel.statsByRecipient({ limit });
    const payload = toChartPayload(rows, {
      labelKey: 'recipient',
      valueKey: 'count',
      fallbackLabel: 'Não informado',
    });

    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por destinatário:', err);
    return res
      .status(500)
      .json({ success: false, error: 'Erro ao obter estatísticas por destinatário.' });
  }
};

exports.statsByStatus = async (_req, res) => {
  try {
    const rows = await MessageModel.statsByStatus();
    const payload = toChartPayload(rows, {
      labelKey: 'label',
      valueKey: 'count',
      fallbackLabel: 'Status desconhecido',
    });

    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por status:', err);
    return res
      .status(500)
      .json({ success: false, error: 'Erro ao obter estatísticas por status.' });
  }
};

exports.statsByMonth = async (req, res) => {
  try {
    const { limit } = req.query || {};
    const rows = await MessageModel.statsByMonth({ limit });
    const payload = toChartPayload(rows, {
      labelKey: 'month',
      valueKey: 'count',
      fallbackLabel: 'Não informado',
      transformLabel: formatMonthLabel,
    });

    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por mês:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por mês.' });
  }
};
