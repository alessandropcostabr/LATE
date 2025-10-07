// models/stats.js
// Comentários em pt-BR; identificadores em inglês.
// Camada de leitura para estatísticas agregadas da tabela "messages". PG-only.

const db = require('../config/database'); // Pool do pg

// Estatísticas gerais no intervalo informado (por created_at)
// Retorna chaves esperadas pelo front: { total, pendente, em_andamento, resolvido }
exports.getMessagesStats = async ({ startAt, endAt }) => {
  const sql = `
    SELECT
      COUNT(*)::int                                                   AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::int                 AS pendente,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int             AS em_andamento,
      COUNT(*) FILTER (WHERE status = 'resolved')::int                AS resolvido
    FROM messages
    WHERE created_at >= $1 AND created_at < $2
  `;
  const { rows } = await db.query(sql, [startAt, endAt]);
  const row = rows?.[0] || {};
  return {
    total: Number(row.total || 0),
    pendente: Number(row.pendente || 0),
    em_andamento: Number(row.em_andamento || 0),
    resolvido: Number(row.resolvido || 0),
  };
};

// Agrupado por status (para gráficos/relatórios)
exports.getStatsByStatus = async () => {
  const sql = `
    SELECT status, COUNT(*)::int AS total
    FROM messages
    GROUP BY status
    ORDER BY status
  `;
  const { rows } = await db.query(sql);
  return rows.map(r => ({ status: r.status, total: Number(r.total || 0) }));
};

// Agrupado por destinatário
exports.getStatsByRecipient = async () => {
  const sql = `
    SELECT COALESCE(NULLIF(TRIM(recipient), ''), 'Não informado') AS recipient, COUNT(*)::int AS total
    FROM messages
    GROUP BY 1
    ORDER BY 1
  `;
  const { rows } = await db.query(sql);
  return rows.map(r => ({ recipient: r.recipient, total: Number(r.total || 0) }));
};

// Últimos 12 meses
exports.getStatsByMonth = async () => {
  const sql = `
    WITH months AS (
      SELECT date_trunc('month', NOW()) - (INTERVAL '1 month' * generate_series(0, 11)) AS m
    )
    SELECT to_char(m, 'YYYY-MM') AS month,
           COALESCE(COUNT(messages.id), 0)::int AS total
    FROM months
    LEFT JOIN messages
      ON date_trunc('month', messages.created_at) = date_trunc('month', m)
    GROUP BY m
    ORDER BY m
  `;
  const { rows } = await db.query(sql);
  return rows.map(r => ({ month: r.month, total: Number(r.total || 0) }));
};

