// models/stats.js
// Comentários em pt-BR; identificadores em inglês.
// Camada de leitura para estatísticas agregadas da tabela "messages". PG-only.

const db = require('../config/database'); // Pool do pg
const { buildViewerOwnershipFilter } = require('./helpers/viewerScope');

const USER_SECTORS_TABLE = 'user_sectors';
const tableSupportCache = new Map();
const tableCheckPromises = new Map();
const RECIPIENT_SECTOR_COLUMN = 'recipient_sector_id';
const columnSupportCache = new Map();
const columnCheckPromises = new Map();

async function supportsUserSectorsTable() {
  if (tableSupportCache.has(USER_SECTORS_TABLE)) {
    return tableSupportCache.get(USER_SECTORS_TABLE);
  }
  if (tableCheckPromises.has(USER_SECTORS_TABLE)) {
    return tableCheckPromises.get(USER_SECTORS_TABLE);
  }

  const sql = `
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = $1
     LIMIT 1
  `;

  const promise = db
    .query(sql, [USER_SECTORS_TABLE])
    .then(({ rowCount }) => {
      const exists = rowCount > 0;
      tableSupportCache.set(USER_SECTORS_TABLE, exists);
      return exists;
    })
    .catch((err) => {
      console.warn('[stats] não foi possível inspecionar tabela user_sectors:', err.message || err);
      tableSupportCache.set(USER_SECTORS_TABLE, false);
      return false;
    })
    .finally(() => {
      tableCheckPromises.delete(USER_SECTORS_TABLE);
    });

  tableCheckPromises.set(USER_SECTORS_TABLE, promise);
  return promise;
}

async function supportsRecipientSectorColumn() {
  if (columnSupportCache.has(RECIPIENT_SECTOR_COLUMN)) {
    return columnSupportCache.get(RECIPIENT_SECTOR_COLUMN);
  }
  if (columnCheckPromises.has(RECIPIENT_SECTOR_COLUMN)) {
    return columnCheckPromises.get(RECIPIENT_SECTOR_COLUMN);
  }

  const sql = `
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'messages'
       AND column_name = $1
     LIMIT 1
  `;

  const promise = db
    .query(sql, [RECIPIENT_SECTOR_COLUMN])
    .then(({ rowCount }) => {
      const exists = rowCount > 0;
      columnSupportCache.set(RECIPIENT_SECTOR_COLUMN, exists);
      return exists;
    })
    .catch((err) => {
      console.warn('[stats] não foi possível inspecionar coluna recipient_sector_id:', err.message || err);
      columnSupportCache.set(RECIPIENT_SECTOR_COLUMN, false);
      return false;
    })
    .finally(() => {
      columnCheckPromises.delete(RECIPIENT_SECTOR_COLUMN);
    });

  columnCheckPromises.set(RECIPIENT_SECTOR_COLUMN, promise);
  return promise;
}

// Estatísticas gerais no intervalo informado (por created_at)
// Retorna chaves esperadas pelo front: { total, pendente, em_andamento, resolvido }
exports.getMessagesStats = async ({ startAt, endAt, viewer } = {}) => {
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const viewerFilter = buildViewerOwnershipFilter(viewer, (i) => `$${i}`, 3, { supportsSectorMembership });
  const sql = `
    SELECT
      COUNT(*)::int                                                   AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::int                 AS pendente,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int             AS em_andamento,
      COUNT(*) FILTER (WHERE status = 'resolved')::int                AS resolvido
    FROM messages
    WHERE created_at >= $1 AND created_at < $2
    ${viewerFilter.clause ? `AND ${viewerFilter.clause}` : ''}
  `;
  const { rows } = await db.query(sql, [startAt, endAt, ...viewerFilter.params]);
  const row = rows?.[0] || {};
  return {
    total: Number(row.total || 0),
    pendente: Number(row.pendente || 0),
    em_andamento: Number(row.em_andamento || 0),
    resolvido: Number(row.resolvido || 0),
  };
};

// Agrupado por status (para gráficos/relatórios)
exports.getStatsByStatus = async ({ viewer } = {}) => {
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const viewerFilter = buildViewerOwnershipFilter(viewer, (i) => `$${i}`, 1, { supportsSectorMembership });
  const sql = `
    SELECT status, COUNT(*)::int AS total
    FROM messages
    ${viewerFilter.clause ? `WHERE ${viewerFilter.clause}` : ''}
    GROUP BY status
    ORDER BY status
  `;
  const { rows } = await db.query(sql, viewerFilter.params);
  return rows.map(r => ({ status: r.status, total: Number(r.total || 0) }));
};

// Agrupado por destinatário
exports.getStatsByRecipient = async ({ viewer } = {}) => {
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const viewerFilter = buildViewerOwnershipFilter(viewer, (i) => `$${i}`, 1, { supportsSectorMembership });
  const sql = `
    SELECT COALESCE(NULLIF(TRIM(recipient), ''), 'Não informado') AS recipient, COUNT(*)::int AS total
    FROM messages
    ${viewerFilter.clause ? `WHERE ${viewerFilter.clause}` : ''}
    GROUP BY 1
    ORDER BY 1
  `;
  const { rows } = await db.query(sql, viewerFilter.params);
  return rows.map(r => ({ recipient: r.recipient, total: Number(r.total || 0) }));
};

// Últimos 12 meses
exports.getStatsByMonth = async ({ viewer, months = 12 } = {}) => {
  const span = Math.max(1, Number(months) || 12);
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const viewerFilter = buildViewerOwnershipFilter(viewer, (i) => `$${i}`, 1, {
    alias: 'ms',
    supportsSectorMembership,
  });
  const sql = `
    WITH months AS (
      SELECT date_trunc('month', NOW()) - (INTERVAL '1 month' * generate_series(0, ${span - 1})) AS m
    )
    SELECT to_char(m, 'YYYY-MM') AS month,
           COALESCE(COUNT(ms.id), 0)::int AS total
    FROM months
    LEFT JOIN messages AS ms
      ON date_trunc('month', ms.created_at) = date_trunc('month', m)
     ${viewerFilter.clause ? ` AND ${viewerFilter.clause}` : ''}
    GROUP BY m
    ORDER BY m
  `;
  const { rows } = await db.query(sql, viewerFilter.params);
  return rows.map(r => ({ month: r.month, total: Number(r.total || 0) }));
};
