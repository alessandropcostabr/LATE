// models/message/messageStats.js

const db = require('../../config/database');
const { buildViewerOwnershipFilter } = require('../helpers/viewerScope');
const {
  CREATED_BY_COLUMN,
  DATE_REF_SQL,
  STATUS_LABELS_PT,
  STATUS_VALUES,
} = require('./constants');
const { buildFilterClause } = require('./filters');
const {
  handleSchemaError,
  resolveSelectColumns,
  supportsColumn,
  supportsRecipientSectorColumn,
  supportsUserSectorsTable,
} = require('./schema');
const {
  ensureStatus,
  normalizeLabelFilter,
  normalizeRecipientSectorId,
  ph,
  trim,
  translateStatusForQuery,
} = require('./utils');

async function stats({ viewer } = {}) {
  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const totalFilter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
  const totalSql = `
    SELECT COUNT(*)::int AS count
      FROM messages
      ${totalFilter.clause ? `WHERE ${totalFilter.clause}` : ''}
  `;
  const total = await db.query(totalSql, totalFilter.params);

  const statusFilter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
  const statusSql = `
    SELECT status, COUNT(*)::int AS count
      FROM messages
      ${statusFilter.clause ? `WHERE ${statusFilter.clause}` : ''}
  GROUP BY status
  `;
  const byStatus = await db.query(statusSql, statusFilter.params);

  const counters = byStatus.rows.reduce((acc, row) => {
    const normalized = ensureStatus(row.status);
    acc[normalized] = (acc[normalized] || 0) + Number(row.count || 0);
    return acc;
  }, {});

  return {
    total: Number(total.rows?.[0]?.count || 0),
    pending: counters.pending || 0,
    in_progress: counters.in_progress || 0,
    resolved: counters.resolved || 0,
  };
}

async function statsByRecipient({ limit = 10, viewer } = {}) {
  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 10;

  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const filter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
  const limitIndex = filter.nextIndex;
  const sql = `
    SELECT
      COALESCE(NULLIF(TRIM(recipient), ''), 'Não informado') AS recipient,
      COUNT(*)::int AS count
      FROM messages
      ${filter.clause ? `WHERE ${filter.clause}` : ''}
  GROUP BY recipient
  ORDER BY count DESC, recipient ASC
     LIMIT ${ph(limitIndex)}
  `;

  const { rows } = await db.query(sql, [...filter.params, sanitizedLimit]);
  return rows.map(r => ({ recipient: r.recipient, count: Number(r.count || 0) }));
}

async function statsByStatus({ viewer } = {}) {
  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const filter = buildViewerOwnershipFilter(viewer, ph, 1, {
    supportsCreator,
    supportsSectorMembership,
  });
  const sql = `
    SELECT status, COUNT(*)::int AS count
      FROM messages
      ${filter.clause ? `WHERE ${filter.clause}` : ''}
  GROUP BY status
  `;
  const { rows } = await db.query(sql, filter.params);
  const totals = STATUS_VALUES.reduce((acc, status) => ({ ...acc, [status]: 0 }), {});
  for (const row of rows) {
    const normalized = ensureStatus(row.status);
    totals[normalized] = (totals[normalized] || 0) + Number(row.count || 0);
  }
  return STATUS_VALUES.map(status => ({
    status,
    label: STATUS_LABELS_PT[status] || status,
    count: totals[status] || 0,
  }));
}

async function statsByMonth({ viewer } = {}) {
  const supportsCreator = await supportsColumn(CREATED_BY_COLUMN);
  const supportsRecipientSector = await supportsRecipientSectorColumn();
  const supportsSectorMembership = supportsRecipientSector && await supportsUserSectorsTable();
  const filter = buildViewerOwnershipFilter(viewer, ph, 1, {
    alias: 'ms',
    supportsCreator,
    supportsSectorMembership,
  });
  const sql = `
    WITH months AS (
      SELECT date_trunc('month', NOW()) - (INTERVAL '1 month' * generate_series(0, 11)) AS m
    )
    SELECT
      to_char(m, 'YYYY-MM') AS month,
      COALESCE(COUNT(ms.id), 0)::int AS count
    FROM months
    LEFT JOIN messages AS ms
      ON date_trunc('month', ms.created_at) = date_trunc('month', m)
     ${filter.clause ? ` AND ${filter.clause}` : ''}
    GROUP BY m
    ORDER BY m;
  `;
  const { rows } = await db.query(sql, filter.params);
  return rows.map(r => ({ month: r.month, count: Number(r.count || 0) }));
}

async function widgetCounters(options = {}, retrying = false) {
  const {
    status,
    start_date,
    end_date,
    recipient,
    viewer,
  } = options;

  const { includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  const recipientSectorEnabled = includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  const statusFilter = translateStatusForQuery(status);
  const startDate = trim(start_date);
  const endDate = trim(end_date);
  const recipientFilter = trim(recipient);
  const sectorId = normalizeRecipientSectorId(
    options.sector_id ??
    options.recipient_sector_id ??
    options.sectorId
  );
  const labelFilter = normalizeLabelFilter(
    options.label ??
    (Array.isArray(options.labels) ? options.labels[0] : null)
  );

  try {
    const filterResult = await buildFilterClause(
      {
        status: statusFilter,
        startDate: startDate || null,
        endDate: endDate || null,
        recipient: recipientFilter || null,
        sectorId,
        label: labelFilter,
      },
      {
        viewer,
        includeCreatedBy,
        recipientSectorEnabled,
        supportsSectorMembership,
        startIndex: 1,
      }
    );

    if (filterResult.emptyResult) {
      return { dueToday: 0, overdue: 0, sla48: 0 };
    }

    const whereClause = filterResult.clause;

    const sql = `
      SELECT
        COUNT(*) FILTER (
          WHERE status <> 'resolved' AND ${DATE_REF_SQL.trim()} = CURRENT_DATE
        )::int AS due_today,
        COUNT(*) FILTER (
          WHERE status <> 'resolved' AND ${DATE_REF_SQL.trim()} < CURRENT_DATE
        )::int AS overdue,
        COUNT(*) FILTER (
          WHERE status = 'pending' AND created_at <= NOW() - INTERVAL '48 hours'
        )::int AS sla48
      FROM messages
      ${whereClause}
    `;

    const { rows } = await db.query(sql, [...filterResult.params]);
    const row = rows?.[0] || {};
    return {
      dueToday: Number(row.due_today || 0),
      overdue: Number(row.overdue || 0),
      sla48: Number(row.sla48 || 0),
    };
  } catch (err) {
    return handleSchemaError(err, retrying, () => widgetCounters(options, true));
  }
}

module.exports = {
  stats,
  statsByRecipient,
  statsByStatus,
  statsByMonth,
  widgetCounters,
};
