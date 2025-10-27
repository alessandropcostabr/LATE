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

const inMemoryLabels = new Map();

function fallbackStorage(messageId) {
  const key = String(messageId);
  if (!inMemoryLabels.has(key)) {
    inMemoryLabels.set(key, new Set());
  }
  return inMemoryLabels.get(key);
}
