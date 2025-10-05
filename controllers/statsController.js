// controllers/statsController.js
// Comentários em pt-BR; identificadores em inglês.
// Controller somente para estatísticas (dashboard/relatórios).

const StatsModel = require('../models/stats');

// Normaliza intervalo de datas recebido por query (aceita start_date/end_date ou data_inicio/data_fim)
function normalizeRange(q = {}) {
  const start = String(q.start_date || q.data_inicio || '').trim();
  const end   = String(q.end_date   || q.data_fim    || '').trim();
  // Sem datas = intervalo amplo (evita 400/500 no dashboard/relatórios)
  const startAt = start ? `${start} 00:00:00`    : '1970-01-01 00:00:00';
  const endAt   = end   ? `${end} 23:59:59.999`  : '2100-01-01 00:00:00';
  return { startAt, endAt };
}

// GET /api/messages/stats
// Retorna no padrão esperado pelo front: { total, pending, in_progress, resolved, labels }
exports.messagesStats = async (req, res) => {
  try {
    const { startAt, endAt } = normalizeRange(req.query);
    const raw = await StatsModel.getMessagesStats({ startAt, endAt }); // { total, pendente, em_andamento, resolvido }

    const data = {
      total: Number(raw.total || 0),
      pending: Number(raw.pendente || 0),
      in_progress: Number(raw.em_andamento || 0),
      resolved: Number(raw.resolvido || 0),
      labels: {
        pending: 'Pendente',
        in_progress: 'Em andamento',
        resolved: 'Resolvido',
      }
    };
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[messages/stats] erro:', err);
    return res.status(400).json({ success: false, error: 'Dados inválidos' });
  }
};

// GET /api/stats/by-status  -> { labels: [...], data: [...] }
exports.byStatus = async (_req, res) => {
  try {
    // rows: [{ status, total }]
    const rows = await StatsModel.getStatsByStatus();
    // Ordem fixa para o gráfico
    const order = ['pending', 'in_progress', 'resolved'];
    const mapLabel = (s) => ({
      pending: 'Pendente',
      in_progress: 'Em andamento',
      resolved: 'Resolvido'
    }[s] || s);

    const totalsByStatus = new Map(rows.map(r => [r.status, Number(r.total || 0)]));
    const labels = order.map(mapLabel);
    const data   = order.map(k => totalsByStatus.get(k) || 0);

    return res.json({ success: true, data: { labels, data } });
  } catch (err) {
    console.error('[stats/by-status] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por status.' });
  }
};

// GET /api/stats/by-recipient -> { labels: [...], data: [...] }
exports.byRecipient = async (_req, res) => {
  try {
    // rows: [{ recipient, total }]; model usa 'Sem destinatário' para NULL
    const rows = await StatsModel.getStatsByRecipient();
    const labels = rows.map(r => (r.recipient === 'Sem destinatário' ? 'Não informado' : r.recipient));
    const data   = rows.map(r => Number(r.total || 0));
    return res.json({ success: true, data: { labels, data } });
  } catch (err) {
    console.error('[stats/by-recipient] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por destinatário.' });
  }
};

// GET /api/stats/by-month -> { labels: ["MM/YYYY", ...], data: [N, ...] }
exports.byMonth = async (_req, res) => {
  try {
    // rows: [{ month: 'YYYY-MM', total: int }]
    const rows = await StatsModel.getStatsByMonth({ months: 12 });

    // Formato que o front espera: MM/YYYY
    const toMMYYYY = (yyyyMM) => {
      // yyyyMM no formato 'YYYY-MM'
      const [y, m] = String(yyyyMM).split('-');
      if (!y || !m) return yyyyMM;
      return `${m}/${y}`;
    };

    const labels = rows.map(r => toMMYYYY(r.month));
    const data   = rows.map(r => Number(r.total || 0));
    return res.json({ success: true, data: { labels, data } });
  } catch (err) {
    console.error('[stats/by-month] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por mês.' });
  }
};

