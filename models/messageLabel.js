// models/messageLabel.js
// Camada de acesso para labels associados aos recados.

const db = require('../config/database');

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

exports.listDistinct = async ({ limit = 100 } = {}) => {
  const parsedLimit = Number(limit);
  const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 500)
    : 100;

  try {
    const { rows } = await db.query(
      `SELECT label, COUNT(*)::int AS usage
         FROM message_labels
     GROUP BY label
     ORDER BY label ASC
        LIMIT $1`,
      [sanitizedLimit]
    );
    return rows.map((row) => ({
      label: row.label,
      count: Number(row.usage || 0),
    }));
  } catch (err) {
    if (isMissingRelation(err)) {
      return [];
    }
    throw err;
  }
};

function fallbackStorage(messageId) {
  const key = String(messageId);
  if (!inMemoryLabels.has(key)) {
    inMemoryLabels.set(key, new Set());
  }
  return inMemoryLabels.get(key);
}
