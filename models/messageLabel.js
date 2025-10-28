// models/messageLabel.js
// Camada de acesso para labels associados aos recados.

const db = require('../config/database');
const { buildViewerOwnershipFilter, normalizeViewScope } = require('./helpers/viewerScope');

const MESSAGE_TABLE = 'messages';
const USER_SECTORS_TABLE = 'user_sectors';

const columnSupportCache = new Map();
const columnCheckPromises = new Map();
const tableSupportCache = new Map();
const tableCheckPromises = new Map();

async function supportsColumn(column) {
  if (columnSupportCache.has(column)) {
    return columnSupportCache.get(column);
  }
  if (columnCheckPromises.has(column)) {
    return columnCheckPromises.get(column);
  }

  const sql = `
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = $1
       AND column_name = $2
     LIMIT 1
  `;

  const promise = db
    .query(sql, [MESSAGE_TABLE, column])
    .then(({ rowCount }) => {
      const exists = rowCount > 0;
      columnSupportCache.set(column, exists);
      return exists;
    })
    .catch((err) => {
      console.warn(`[labels] não foi possível inspecionar coluna ${column}:`, err.message || err);
      columnSupportCache.set(column, false);
      return false;
    })
    .finally(() => {
      columnCheckPromises.delete(column);
    });

  columnCheckPromises.set(column, promise);
  return promise;
}

async function supportsTable(table) {
  if (tableSupportCache.has(table)) {
    return tableSupportCache.get(table);
  }
  if (tableCheckPromises.has(table)) {
    return tableCheckPromises.get(table);
  }

  const sql = `
    SELECT 1
      FROM information_schema.tables
     WHERE table_schema = current_schema()
       AND table_name = $1
     LIMIT 1
  `;

  const promise = db
    .query(sql, [table])
    .then(({ rowCount }) => {
      const exists = rowCount > 0;
      tableSupportCache.set(table, exists);
      return exists;
    })
    .catch((err) => {
      console.warn(`[labels] não foi possível inspecionar tabela ${table}:`, err.message || err);
      tableSupportCache.set(table, false);
      return false;
    })
    .finally(() => {
      tableCheckPromises.delete(table);
    });

  tableCheckPromises.set(table, promise);
  return promise;
}

const LABEL_REGEX = /^[a-z0-9\-_.]{2,32}$/i;

function isMissingRelation(err) {
  return err && err.code === '42P01';
}

function normalizeLabel(label) {
  if (typeof label !== 'string') return '';
  return label.trim().toLowerCase();
}

exports.listByMessage = async (messageId) => {
  try {
    const { rows } = await db.query(
      `SELECT label
         FROM message_labels
        WHERE message_id = $1
     ORDER BY label ASC`,
      [messageId]
    );
    return rows.map((row) => row.label);
  } catch (err) {
    if (isMissingRelation(err)) {
      return [];
    }
    throw err;
  }
};

exports.addLabel = async (messageId, rawLabel) => {
  const label = normalizeLabel(rawLabel);
  if (!LABEL_REGEX.test(label)) {
    const err = new Error('Label inválida.');
    err.code = 'INVALID_LABEL';
    throw err;
  }

  try {
    await db.query(
      `INSERT INTO message_labels (message_id, label)
       VALUES ($1, $2)
       ON CONFLICT (message_id, label) DO NOTHING`,
      [messageId, label]
    );
  } catch (err) {
    if (isMissingRelation(err)) {
      console.warn('[labels] tabela message_labels ausente. Rode as migrations da Sprint A.');
      const fallback = fallbackStorage(messageId);
      fallback.add(label);
      return label;
    }
    throw err;
  }

  return label;
};

exports.removeLabel = async (messageId, rawLabel) => {
  const label = normalizeLabel(rawLabel);
  await db.query(
    `DELETE FROM message_labels
      WHERE message_id = $1
        AND label = $2`,
    [messageId, label]
  );
  return label;
};

exports.replaceLabels = async (messageId, labels) => {
  const normalized = Array.isArray(labels)
    ? labels
        .map(normalizeLabel)
        .filter((value, index, array) => LABEL_REGEX.test(value) && array.indexOf(value) === index)
    : [];

  try {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM message_labels WHERE message_id = $1', [messageId]);

      if (normalized.length) {
        const values = normalized.map((label, idx) => `($1, $${idx + 2})`).join(', ');
        await client.query(
          `INSERT INTO message_labels (message_id, label) VALUES ${values}`,
          [messageId, ...normalized]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (isMissingRelation(err)) {
      console.warn('[labels] tabela message_labels ausente. Rode as migrations da Sprint A.');
      const fallback = fallbackStorage(messageId);
      fallback.clear();
      normalized.forEach((label) => fallback.add(label));
      return Array.from(fallback.values());
    }
    throw err;
  }

  return normalized;
};

exports.LABEL_REGEX = LABEL_REGEX;
exports.normalizeLabel = normalizeLabel;

exports.listByMessages = async (messageIds) => {
  const ids = Array.isArray(messageIds)
    ? Array.from(new Set(messageIds.filter((id) => Number.isInteger(Number(id)))))
    : [];

  if (!ids.length) {
    return new Map();
  }

  try {
    const { rows } = await db.query(
      `SELECT message_id, label
         FROM message_labels
        WHERE message_id = ANY($1::bigint[])
     ORDER BY message_id ASC, label ASC`,
      [ids]
    );

    return rows.reduce((acc, row) => {
      const key = row.message_id;
      const current = acc.get(key) || [];
      current.push(row.label);
      acc.set(key, current);
      return acc;
    }, new Map());
  } catch (err) {
    if (isMissingRelation(err)) {
      return new Map();
    }
    throw err;
  }
};

const inMemoryLabels = new Map();

async function listDistinctInternal(options = {}, retrying = false) {
  const { limit = 100, viewer } = options;
  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 500)
    : 100;

  try {
    const scope = normalizeViewScope(viewer?.viewScope || viewer?.view_scope);
    let whereClause = '';
    const params = [];
    let nextIndex = 1;

    if (scope === 'own') {
      const [
        supportsRecipientUser,
        supportsCreator,
        supportsRecipientSector,
        supportsVisibility,
      ] = await Promise.all([
        supportsColumn('recipient_user_id'),
        supportsColumn('created_by'),
        supportsColumn('recipient_sector_id'),
        supportsColumn('visibility'),
      ]);

      if (!supportsRecipientUser || !supportsVisibility) {
        return [];
      }

      const supportsSectorMembership = supportsRecipientSector && await supportsTable(USER_SECTORS_TABLE);

      const ownershipFilter = buildViewerOwnershipFilter(
        viewer,
        (i) => `$${i}`,
        nextIndex,
        {
          alias: 'm',
          supportsCreator,
          supportsSectorMembership,
        }
      );

      if (ownershipFilter.clause) {
        whereClause = `WHERE ${ownershipFilter.clause}`;
        params.push(...ownershipFilter.params);
        nextIndex = ownershipFilter.nextIndex;
      }
    }

    const limitIndex = nextIndex;
    params.push(sanitizedLimit);

    const sql = `
      SELECT ml.label, COUNT(*)::int AS usage
        FROM message_labels AS ml
        JOIN messages AS m ON m.id = ml.message_id
        ${whereClause}
    GROUP BY ml.label
    ORDER BY ml.label ASC
       LIMIT $${limitIndex}
    `;

    const { rows } = await db.query(sql, params);
    return rows.map((row) => ({
      label: row.label,
      count: Number(row.usage || 0),
    }));
  } catch (err) {
    if (!retrying) {
      const message = String(err?.message || '').toLowerCase();
      if (message.includes('recipient_sector_id')) {
        columnSupportCache.set('recipient_sector_id', false);
        return listDistinctInternal(options, true);
      }
      if (message.includes('created_by')) {
        columnSupportCache.set('created_by', false);
        return listDistinctInternal(options, true);
      }
      if (message.includes('recipient_user_id')) {
        columnSupportCache.set('recipient_user_id', false);
        return listDistinctInternal(options, true);
      }
      if (message.includes('visibility')) {
        columnSupportCache.set('visibility', false);
        return [];
      }
    }

    if (isMissingRelation(err)) {
      return [];
    }
    throw err;
  }
}

exports.listDistinct = (options) => listDistinctInternal(options, false);

function fallbackStorage(messageId) {
  const key = String(messageId);
  if (!inMemoryLabels.has(key)) {
    inMemoryLabels.set(key, new Set());
  }
  return inMemoryLabels.get(key);
}
