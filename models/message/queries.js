// models/message/queries.js

const db = require('../../config/database');
const { buildViewerOwnershipFilter } = require('../helpers/viewerScope');
const {
  CREATED_BY_COLUMN,
  DATE_REF_SQL,
  PARENT_MESSAGE_COLUMN,
  RECIPIENT_SECTOR_COLUMN,
  STATUS_LABELS_PT,
  STATUS_VALUES,
  UPDATED_BY_COLUMN,
} = require('./constants');
const {
  buildContactMatchConditions,
  buildFilterClause,
  appendCondition,
} = require('./filters');
const {
  handleSchemaError,
  resolveSelectColumns,
  supportsColumn,
  supportsRecipientSectorColumn,
  supportsTable,
  supportsUserSectorsTable,
} = require('./schema');
const {
  attachTimestamps,
  emptyToNull,
  ensureStatus,
  mapRow,
  normalizeLabelFilter,
  normalizePayload,
  normalizeRecipientSectorId,
  normalizeUserId,
  normalizeVisibility,
  ph,
  trim,
  translateStatusForQuery,
} = require('./utils');

const BENCH_ALERTS_VERBOSE = ['1', 'true', 'yes', 'on'].includes(String(process.env.BENCH_ALERTS_VERBOSE || '').toLowerCase());

function benchListLog(...args) {
  if (BENCH_ALERTS_VERBOSE) {
    console.info('[bench-alerts][message.list]', ...args);
  }
}

async function create(payload) {
  const {
    includeRecipientUserId,
    includeRecipientSectorId,
    includeCreatedBy,
    includeUpdatedBy,
    includeParentMessageId,
    selectColumns,
  } = await resolveSelectColumns();

  const normalized = normalizePayload(payload);
  const timestamps = attachTimestamps({}, payload);
  const creatorId = normalizeUserId(payload?.created_by ?? payload?.createdBy);
  const updaterSource = payload?.updated_by ?? payload?.updatedBy;
  const updaterId = normalizeUserId(
    updaterSource !== undefined ? updaterSource : creatorId
  );

  const data = {
    ...normalized.data,
    status: normalized.statusProvided && normalized.data.status ? normalized.data.status : 'pending',
  };

  if (normalized.callbackProvided) {
    data.callback_at = normalized.data.callback_at ?? null;
  } else {
    data.callback_at = data.callback_at ?? null;
  }

  if (data.visibility === undefined) {
    data.visibility = 'private';
  }

  if (includeCreatedBy) {
    data.created_by = creatorId ?? null;
  }
  if (includeUpdatedBy) {
    data.updated_by = updaterId ?? null;
  }

  const hasRecipientUserId = Object.prototype.hasOwnProperty.call(data, 'recipient_user_id');
  const shouldIncludeRecipientUserId = includeRecipientUserId && hasRecipientUserId;

  const hasRecipientSectorId = Object.prototype.hasOwnProperty.call(data, 'recipient_sector_id');
  const shouldIncludeRecipientSectorId = includeRecipientSectorId && hasRecipientSectorId;

  const hasParentMessageId = Object.prototype.hasOwnProperty.call(data, PARENT_MESSAGE_COLUMN);
  const shouldIncludeParentMessageId = includeParentMessageId && hasParentMessageId;

  if (!includeRecipientUserId && hasRecipientUserId) {
    delete data.recipient_user_id;
  }

  if (!includeRecipientSectorId && hasRecipientSectorId) {
    delete data.recipient_sector_id;
  }

  if (!includeParentMessageId && hasParentMessageId) {
    delete data.parent_message_id;
  }

  const baseFields = [
    'call_date',
    'call_time',
    'recipient',
    'sender_name',
    'sender_phone',
    'sender_email',
    'subject',
    'message',
    'status',
    'visibility',
    'callback_at',
    'notes',
  ];
  const fields = [...baseFields];

  if (!normalized.callbackProvided) {
    const callbackIndex = fields.indexOf('callback_at');
    if (callbackIndex !== -1) fields.splice(callbackIndex, 1);
  } else {
    normalized.data.callback_at = normalized.data.callback_at ?? null;
  }

  if (shouldIncludeRecipientUserId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_user_id');
  }

  if (shouldIncludeRecipientSectorId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_sector_id');
  }
  if (shouldIncludeParentMessageId) {
    fields.push(PARENT_MESSAGE_COLUMN);
  }

  if (includeCreatedBy) {
    fields.push('created_by');
  }

  if (includeUpdatedBy) {
    fields.push('updated_by');
  }

  const values = fields.map((field) => data[field]);

  if (timestamps.created_at) {
    fields.push('created_at');
    values.push(timestamps.created_at);
  }
  if (timestamps.updated_at) {
    fields.push('updated_at');
    values.push(timestamps.updated_at);
  }

  const sql = `
    INSERT INTO messages (
      ${fields.join(',\n      ')}
    ) VALUES (
      ${fields.map((_, index) => ph(index + 1)).join(', ')}
    )
    RETURNING ${selectColumns}
  `;

  const { rows } = await db.query(sql, values);
  return rows?.[0]?.id || null;
}

async function findById(id, { viewer } = {}, retrying = false) {
  const { selectColumns, includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  const recipientSectorEnabled = includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();
  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, 2, {
    supportsCreator: includeCreatedBy,
    supportsSectorMembership,
  });
  const sql = `
    SELECT ${selectColumns}
      FROM messages
     WHERE id = ${ph(1)}
     ${ownershipFilter.clause ? `AND ${ownershipFilter.clause}` : ''}
     LIMIT 1
  `;
  const params = ownershipFilter.clause ? [id, ...ownershipFilter.params] : [id];
  try {
    const { rows } = await db.query(sql, params);
    return mapRow(rows?.[0]);
  } catch (err) {
    return handleSchemaError(err, retrying, () => findById(id, { viewer }, true));
  }
}

async function update(id, payload, retrying = false) {
  const {
    includeRecipientUserId,
    includeRecipientSectorId,
    includeUpdatedBy,
    includeParentMessageId,
  } = await resolveSelectColumns();
  const normalized = normalizePayload(payload);
  const hasRecipientUserId = Object.prototype.hasOwnProperty.call(normalized.data, 'recipient_user_id');
  const shouldIncludeRecipientUserId = includeRecipientUserId && hasRecipientUserId;
  const hasRecipientSectorId = Object.prototype.hasOwnProperty.call(normalized.data, 'recipient_sector_id');
  const shouldIncludeRecipientSectorId = includeRecipientSectorId && hasRecipientSectorId;
  const hasParentMessageId = Object.prototype.hasOwnProperty.call(normalized.data, PARENT_MESSAGE_COLUMN);
  const shouldIncludeParentMessageId = includeParentMessageId && hasParentMessageId;

  if (!includeRecipientUserId && hasRecipientUserId) {
    delete normalized.data.recipient_user_id;
  }
  if (!includeRecipientSectorId && hasRecipientSectorId) {
    delete normalized.data.recipient_sector_id;
  }
  if (!includeParentMessageId && hasParentMessageId) {
    delete normalized.data.parent_message_id;
  }

  const baseFields = [
    'call_date',
    'call_time',
    'recipient',
    'sender_name',
    'sender_phone',
    'sender_email',
    'subject',
    'message',
    'callback_at',
    'notes',
  ];
  const fields = [...baseFields];

  if (!normalized.callbackProvided) {
    const callbackIndex = fields.indexOf('callback_at');
    if (callbackIndex !== -1) fields.splice(callbackIndex, 1);
  } else {
    normalized.data.callback_at = normalized.data.callback_at ?? null;
  }

  if (shouldIncludeRecipientUserId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_user_id');
  }
  if (shouldIncludeRecipientSectorId) {
    const recipientIndex = fields.indexOf('recipient');
    const insertAt = recipientIndex >= 0 ? recipientIndex + 1 : fields.length;
    fields.splice(insertAt, 0, 'recipient_sector_id');
  }
  if (shouldIncludeParentMessageId) {
    fields.push(PARENT_MESSAGE_COLUMN);
  }
  const values = fields.map((field) => normalized.data[field]);
  const assignments = fields.map((field, idx) => `${field} = ${ph(idx + 1)}`);
  const params = [...values];
  let nextIndex = assignments.length + 1;

  assignments.push(`status = COALESCE(${ph(nextIndex)}, status)`);
  params.push(normalized.statusProvided ? normalized.data.status : null);
  nextIndex += 1;

  assignments.push(`visibility = COALESCE(${ph(nextIndex)}, visibility)`);
  params.push(normalized.visibilityProvided ? normalizeVisibility(normalized.data.visibility) : null);
  nextIndex += 1;

  const hasUpdatedByField = includeUpdatedBy && (
    (payload && Object.prototype.hasOwnProperty.call(payload, 'updated_by')) ||
    (payload && Object.prototype.hasOwnProperty.call(payload, 'updatedBy'))
  );

  if (hasUpdatedByField) {
    assignments.push(`updated_by = ${ph(nextIndex)}`);
    params.push(normalizeUserId(payload.updated_by ?? payload.updatedBy));
    nextIndex += 1;
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    UPDATE messages
       SET ${assignments.join(', ')}
     WHERE id = ${ph(nextIndex)}
  `;
  params.push(id);
  try {
    const { rowCount } = await db.query(sql, params);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => update(id, payload, true));
  }
}

async function updateRecipient(id, options = {}, retrying = false) {
  const {
    recipient,
    recipient_user_id = null,
    recipient_sector_id = null,
  } = options;
  const { includeRecipientUserId, includeRecipientSectorId } = await resolveSelectColumns();
  const assignments = [];
  const params = [];
  let index = 0;

  assignments.push(`recipient = ${ph(++index)}`);
  params.push(emptyToNull(recipient));

  if (includeRecipientUserId) {
    assignments.push(`recipient_user_id = ${ph(++index)}`);
    params.push(recipient_user_id ?? null);
  }

  if (includeRecipientSectorId) {
    assignments.push(`recipient_sector_id = ${ph(++index)}`);
    params.push(recipient_sector_id ?? null);
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    UPDATE messages
       SET ${assignments.join(', ')}
     WHERE id = ${ph(++index)}
  `;

  params.push(id);

  try {
    const { rowCount } = await db.query(sql, params);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => updateRecipient(id, options, true));
  }
}

async function updateStatus(id, status, { updatedBy, client } = {}, retrying = false) {
  const normalizedStatus = ensureStatus(status);
  const executor = client || db;
  if (updatedBy !== undefined) {
    const canUpdateUser = await supportsColumn(UPDATED_BY_COLUMN);
    if (canUpdateUser) {
      const sqlWithUser = `
      UPDATE messages
         SET status = ${ph(1)},
             updated_by = ${ph(2)},
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ${ph(3)}
    `;
      try {
        const { rowCount } = await executor.query(sqlWithUser, [
          normalizedStatus,
          normalizeUserId(updatedBy),
          id,
        ]);
        return rowCount > 0;
      } catch (err) {
        return handleSchemaError(err, retrying, () => updateStatus(id, status, { updatedBy, client }, true));
      }
    }
  }

  const sql = `
    UPDATE messages
       SET status = ${ph(1)},
           updated_at = CURRENT_TIMESTAMP
     WHERE id = ${ph(2)}
  `;
  try {
    const { rowCount } = await executor.query(sql, [normalizedStatus, id]);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => updateStatus(id, status, { updatedBy, client }, true));
  }
}

async function remove(id, retrying = false) {
  try {
    const { rowCount } = await db.query(`DELETE FROM messages WHERE id = ${ph(1)}`, [id]);
    return rowCount > 0;
  } catch (err) {
    return handleSchemaError(err, retrying, () => remove(id, true));
  }
}

async function listRelatedMessages(options = {}, retrying = false) {
  const {
    phone,
    email,
    excludeId,
    viewer,
    limit = 5,
  } = options;

  const contactMatch = buildContactMatchConditions({ phone, email }, 1);
  if (contactMatch.empty) {
    return [];
  }

  const {
    selectColumns,
    includeCreatedBy,
    includeRecipientSectorId,
  } = await resolveSelectColumns();
  const recipientSectorEnabled = includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  let whereClause = `WHERE ${contactMatch.clause}`;
  const params = [...contactMatch.params];
  let nextIndex = contactMatch.nextIndex;

  if (excludeId) {
    whereClause = appendCondition(whereClause, `id <> ${ph(nextIndex)}`);
    params.push(excludeId);
    nextIndex += 1;
  }

  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, nextIndex, {
    supportsCreator: includeCreatedBy,
    supportsSectorMembership,
  });

  if (ownershipFilter.clause) {
    whereClause = appendCondition(whereClause, ownershipFilter.clause);
    params.push(...ownershipFilter.params);
    nextIndex = ownershipFilter.nextIndex;
  }

  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 20) : 5;

  const sql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY created_at DESC, id DESC
     LIMIT ${ph(nextIndex)}
  `;
  params.push(sanitizedLimit);

  try {
    const { rows } = await db.query(sql, params);
    return rows.map(mapRow);
  } catch (err) {
    return handleSchemaError(err, retrying, () => listRelatedMessages(options, true));
  }
}

async function listContactHistory(options = {}, retrying = false) {
  const {
    phone,
    email,
    viewer,
    limit = 50,
    offset = 0,
    status,
    recipient,
    label,
    labels,
    sectorId,
  } = options;

  const contactMatch = buildContactMatchConditions({ phone, email }, 1);
  if (contactMatch.empty) {
    return [];
  }

  const {
    selectColumns,
    includeCreatedBy,
    includeRecipientSectorId,
  } = await resolveSelectColumns();
  const recipientSectorEnabled = includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  let whereClause = '';
  const params = [];
  let nextIndex = 1;

  whereClause = appendCondition(whereClause, contactMatch.clause);
  params.push(...contactMatch.params);
  nextIndex = contactMatch.nextIndex;

  const statusFilter = translateStatusForQuery(status);
  if (statusFilter) {
    const clause = `status IN (${ph(nextIndex)}, ${ph(nextIndex + 1)})`;
    whereClause = appendCondition(whereClause, clause);
    params.push(statusFilter.current, statusFilter.legacy);
    nextIndex += 2;
  }

  const trimmedRecipient = trim(recipient);
  if (trimmedRecipient) {
    const clause = `LOWER(COALESCE(TRIM(recipient), '')) LIKE ${ph(nextIndex)}`;
    whereClause = appendCondition(whereClause, clause);
    params.push(`%${trimmedRecipient.toLowerCase()}%`);
    nextIndex += 1;
  }

  const sectorNormalized = normalizeRecipientSectorId(
    sectorId ??
    options.recipient_sector_id ??
    options.recipientSectorId
  );

  if (sectorNormalized && recipientSectorEnabled) {
    const clause = `recipient_sector_id = ${ph(nextIndex)}`;
    whereClause = appendCondition(whereClause, clause);
    params.push(sectorNormalized);
    nextIndex += 1;
  }

  let labelFilter = label;
  if (!labelFilter && Array.isArray(labels) && labels.length) {
    labelFilter = labels[0];
  }
  const normalizedLabel = normalizeLabelFilter(labelFilter);
  if (normalizedLabel) {
    const supportsLabels = await supportsTable('message_labels');
    if (supportsLabels) {
      const clause = `
        id IN (
          SELECT ml.message_id
            FROM message_labels AS ml
           WHERE ml.label = ${ph(nextIndex)}
        )
      `;
      whereClause = appendCondition(whereClause, clause);
      params.push(normalizedLabel);
      nextIndex += 1;
    }
  }

  const ownershipFilter = buildViewerOwnershipFilter(viewer, ph, nextIndex, {
    supportsCreator: includeCreatedBy,
    supportsSectorMembership,
  });

  if (ownershipFilter.clause) {
    whereClause = appendCondition(whereClause, ownershipFilter.clause);
    params.push(...ownershipFilter.params);
    nextIndex = ownershipFilter.nextIndex;
  }

  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
  const parsedOffset = Number(offset);
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const sql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY created_at DESC, id DESC
     LIMIT ${ph(nextIndex)} OFFSET ${ph(nextIndex + 1)}
  `;

  params.push(sanitizedLimit, sanitizedOffset);

  try {
    const { rows } = await db.query(sql, params);
    return rows.map(mapRow);
  } catch (err) {
    return handleSchemaError(err, retrying, () => listContactHistory(options, true));
  }
}

async function list(options = {}, retrying = false) {
  benchListLog('inicio');
  const {
    limit = 10,
    offset = 0,
    status,
    start_date,
    end_date,
    recipient,
    order_by = 'created_at',
    order = 'desc',
    viewer,
    use_callback_date = false,
  } = options;

  benchListLog('resolveSelectColumns: inicio');
  const { selectColumns, includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  benchListLog('resolveSelectColumns: ok');
  const recipientSectorEnabled = includeRecipientSectorId;
  if (recipientSectorEnabled) {
    benchListLog('supportsUserSectorsTable: inicio');
  }
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();
  if (recipientSectorEnabled) {
    benchListLog('supportsUserSectorsTable: ok');
  }

  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const orderByAllowed = ['created_at', 'updated_at', 'id', 'status', 'date_ref', 'callback_at'];
  const orderKey = orderByAllowed.includes(String(order_by)) ? String(order_by) : 'created_at';
  const sort = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const dateOrderSql = `(${DATE_REF_SQL.trim()})`;
  let primaryOrderClause;
  if (orderKey === 'date_ref') {
    primaryOrderClause = `${dateOrderSql} ${sort}`;
  } else if (orderKey === 'callback_at') {
    primaryOrderClause = `callback_at ${sort} NULLS LAST`;
  } else {
    primaryOrderClause = `${orderKey} ${sort}`;
  }

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

  benchListLog('buildFilterClause: inicio');
  const filterResult = await buildFilterClause(
    {
      status: statusFilter,
      startDate: startDate || null,
      endDate: endDate || null,
      recipient: recipientFilter || null,
      sectorId,
      label: labelFilter,
      dateMode: use_callback_date ? 'callback' : 'date_ref',
    },
    {
      viewer,
      includeCreatedBy,
      recipientSectorEnabled,
      supportsSectorMembership,
      startIndex: 1,
    }
  );
  benchListLog('buildFilterClause: ok');

  if (filterResult.emptyResult) {
    benchListLog('emptyResult');
    return [];
  }

  let whereClause = filterResult.clause;
  const queryParams = [...filterResult.params];
  let nextIndex = filterResult.nextIndex;

  const sql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY ${primaryOrderClause}, id DESC
     LIMIT ${ph(nextIndex)} OFFSET ${ph(nextIndex + 1)}
  `;

  try {
    benchListLog('query: inicio');
    const { rows } = await db.query(sql, [...queryParams, sanitizedLimit, sanitizedOffset]);
    benchListLog(`query: ok rows=${rows.length}`);
    return rows.map(mapRow);
  } catch (err) {
    return handleSchemaError(err, retrying, () => list(options, true));
  }
}

async function listWithTotal(options = {}, retrying = false) {
  const {
    limit = 10,
    offset = 0,
    status,
    start_date,
    end_date,
    recipient,
    order_by = 'created_at',
    order = 'desc',
    viewer,
    use_callback_date = false,
  } = options;

  const { selectColumns, includeCreatedBy, includeRecipientSectorId } = await resolveSelectColumns();
  const recipientSectorEnabled = includeRecipientSectorId;
  const supportsSectorMembership = recipientSectorEnabled && await supportsUserSectorsTable();

  const parsedLimit = Number(limit);
  const parsedOffset = Number(offset);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 10;
  const sanitizedOffset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const orderByAllowed = ['created_at', 'updated_at', 'id', 'status', 'date_ref', 'callback_at'];
  const orderKey = orderByAllowed.includes(String(order_by)) ? String(order_by) : 'created_at';
  const sort = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const dateOrderSql = `(${DATE_REF_SQL.trim()})`;
  let primaryOrderClause;
  if (orderKey === 'date_ref') {
    primaryOrderClause = `${dateOrderSql} ${sort}`;
  } else if (orderKey === 'callback_at') {
    primaryOrderClause = `callback_at ${sort} NULLS LAST`;
  } else {
    primaryOrderClause = `${orderKey} ${sort}`;
  }

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

  const filterResult = await buildFilterClause(
    {
      status: statusFilter,
      startDate: startDate || null,
      endDate: endDate || null,
      recipient: recipientFilter || null,
      sectorId,
      label: labelFilter,
      dateMode: use_callback_date ? 'callback' : 'date_ref',
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
    return { rows: [], total: 0 };
  }

  let whereClause = filterResult.clause;
  const queryParams = [...filterResult.params];
  let nextIndex = filterResult.nextIndex;

  const dataSql = `
    SELECT ${selectColumns}
      FROM messages
      ${whereClause}
  ORDER BY ${primaryOrderClause}, id DESC
     LIMIT ${ph(nextIndex)} OFFSET ${ph(nextIndex + 1)}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS count
      FROM messages
      ${whereClause}
  `;

  try {
    const [dataResult, countResult] = await Promise.all([
      db.query(dataSql, [...queryParams, sanitizedLimit, sanitizedOffset]),
      db.query(countSql, queryParams),
    ]);

    const total = Number(countResult.rows?.[0]?.count || 0);
    return {
      rows: dataResult.rows.map(mapRow),
      total,
    };
  } catch (err) {
    return handleSchemaError(err, retrying, () => listWithTotal(options, true));
  }
}

async function listRecent(limit = 10, { viewer } = {}) {
  return list({ limit, order_by: 'created_at', order: 'desc', viewer });
}

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
  create,
  findById,
  update,
  updateStatus,
  remove,
  list,
  listWithTotal,
  listRelatedMessages,
  listContactHistory,
  listRecent,
  stats,
  statsByRecipient,
  statsByStatus,
  statsByMonth,
  widgetCounters,
  updateRecipient,
};
