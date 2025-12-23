// models/message/messageFilters.js

const { buildViewerOwnershipFilter } = require('../helpers/viewerScope');
const { normalizePhone, normalizeEmail } = require('../../utils/normalizeContact');
const { DATE_REF_SQL } = require('./constants');
const { supportsTable } = require('./schema');
const {
  ph,
  trim,
} = require('./utils');

function buildSearchClause(search, startIndex = 1) {
  const term = trim(search);
  if (!term) {
    return { clause: '', params: [], nextIndex: startIndex };
  }

  let index = startIndex;
  const clauses = [];
  const params = [];
  const likeTerm = `%${term.toLowerCase()}%`;

  const likeFields = [
    `LOWER(COALESCE(TRIM(sender_name), '')) LIKE ${ph(index)}`,
    `LOWER(COALESCE(TRIM(sender_email), '')) LIKE ${ph(index + 1)}`,
    `LOWER(COALESCE(TRIM(recipient), '')) LIKE ${ph(index + 2)}`,
  ];

  clauses.push(...likeFields);
  params.push(likeTerm, likeTerm, likeTerm);
  index += 3;

  const normalizedPhone = normalizePhone(term);
  if (normalizedPhone) {
    clauses.push(`regexp_replace(COALESCE(sender_phone, ''), '[^0-9]+', '', 'g') LIKE ${ph(index)}`);
    params.push(`%${normalizedPhone}%`);
    index += 1;
  }

  return {
    clause: clauses.length ? `(${clauses.join(' OR ')})` : '',
    params,
    nextIndex: index,
  };
}

function buildFilters({ status, startDate, endDate, recipient, search }, startIndex = 1, { dateMode = 'date_ref' } = {}) {
  let index = startIndex;
  const clauses = [];
  const params = [];

  const dateExpression = dateMode === 'callback'
    ? 'callback_at::date'
    : `(${DATE_REF_SQL.trim()})`;

  if (status) {
    clauses.push(`status IN (${ph(index)}, ${ph(index + 1)})`);
    params.push(status.current, status.legacy);
    index += 2;
  }

  if (startDate) {
    clauses.push(`${dateExpression} >= ${ph(index)}::date`);
    params.push(startDate);
    index += 1;
  }

  if (endDate) {
    clauses.push(`${dateExpression} <= ${ph(index)}::date`);
    params.push(endDate);
    index += 1;
  }

  if (recipient) {
    clauses.push(`LOWER(COALESCE(TRIM(recipient), '')) LIKE ${ph(index)}`);
    params.push(`%${recipient.toLowerCase()}%`);
    index += 1;
  }

  if (search) {
    const searchClause = buildSearchClause(search, index);
    if (searchClause.clause) {
      clauses.push(searchClause.clause);
      params.push(...searchClause.params);
      index = searchClause.nextIndex;
    }
  }

  return {
    clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
    nextIndex: index,
  };
}

function buildContactMatchConditions({ phone, email }, startIndex = 1) {
  let index = startIndex;
  const clauses = [];
  const params = [];
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  if (normalizedPhone) {
    clauses.push(`regexp_replace(COALESCE(sender_phone, ''), '[^0-9]+', '', 'g') = ${ph(index)}`);
    params.push(normalizedPhone);
    index += 1;
  }

  if (normalizedEmail) {
    clauses.push(`LOWER(TRIM(sender_email)) = ${ph(index)}`);
    params.push(normalizedEmail);
    index += 1;
  }

  if (clauses.length === 0) {
    return {
      clause: '',
      params: [],
      nextIndex: startIndex,
      empty: true,
    };
  }

  return {
    clause: clauses.length === 1 ? clauses[0] : `(${clauses.join(' OR ')})`,
    params,
    nextIndex: index,
    empty: false,
  };
}

function appendCondition(baseClause, condition) {
  if (!condition) return baseClause;
  if (!baseClause) {
    return `WHERE ${condition}`;
  }
  return `${baseClause} AND ${condition}`;
}

async function buildFilterClause(
  { status, startDate, endDate, recipient, search, sectorId, label, dateMode = 'date_ref' },
  {
    viewer,
    includeCreatedBy,
    recipientSectorEnabled,
    supportsSectorMembership,
    startIndex = 1,
  } = {}
) {
  const baseFilters = buildFilters(
    { status, startDate, endDate, recipient, search },
    startIndex,
    { dateMode }
  );

  let whereClause = baseFilters.clause;
  const params = [...baseFilters.params];
  let nextIndex = baseFilters.nextIndex;

  if (dateMode === 'callback') {
    whereClause = appendCondition(whereClause, 'callback_at IS NOT NULL');
  }

  if (sectorId) {
    if (!recipientSectorEnabled) {
      return { clause: 'WHERE 1=0', params: [], nextIndex: startIndex, emptyResult: true };
    }
    whereClause = appendCondition(whereClause, `recipient_sector_id = ${ph(nextIndex)}`);
    params.push(sectorId);
    nextIndex += 1;
  }

  if (label) {
    const supportsLabels = await supportsTable('message_labels');
    if (!supportsLabels) {
      return { clause: 'WHERE 1=0', params: [], nextIndex: startIndex, emptyResult: true };
    }
    whereClause = appendCondition(
      whereClause,
      `id IN (
        SELECT ml.message_id
          FROM message_labels AS ml
         WHERE ml.label = ${ph(nextIndex)}
      )`
    );
    params.push(label);
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

  return { clause: whereClause, params, nextIndex, emptyResult: false };
}

module.exports = {
  appendCondition,
  buildContactMatchConditions,
  buildFilterClause,
  buildFilters,
  buildSearchClause,
};
