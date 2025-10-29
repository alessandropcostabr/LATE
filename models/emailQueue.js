// models/emailQueue.js
// Fila de e-mails com backoff exponencial.

const db = require('../config/database');

const DEFAULT_STATUS = 'pending';
const MAX_ATTEMPTS = Number(process.env.EMAIL_QUEUE_MAX_ATTEMPTS || 5);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    to_email: row.to_email,
    subject: row.subject,
    body_json: row.body_json,
    status: row.status,
    attempts: Number(row.attempts || 0),
    next_run_at: row.next_run_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

exports.enqueue = async ({ toEmail, subject, body, nextRunAt = null }) => {
  const { rows } = await db.query(
    `INSERT INTO email_queue (to_email, subject, body_json, status, next_run_at)
         VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
    [toEmail, subject, body || {}, DEFAULT_STATUS, nextRunAt]
  );
  return mapRow(rows?.[0]);
};

exports.pullPending = async (limit = 10) => {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT *
         FROM email_queue
        WHERE status = 'pending'
          AND (next_run_at IS NULL OR next_run_at <= NOW())
     ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED`,
      [safeLimit]
    );

    if (rows.length) {
      const ids = rows.map((row) => row.id);
      await client.query(
        `UPDATE email_queue
            SET status = 'processing',
                updated_at = NOW()
          WHERE id = ANY($1::uuid[])`,
        [ids]
      );
    }

    await client.query('COMMIT');
    return rows.map(mapRow);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.markSent = async (id) => {
  await db.query(
    `UPDATE email_queue
        SET status = 'sent',
            last_error = NULL,
            updated_at = NOW()
      WHERE id = $1`,
    [id]
  );
};

exports.markErrored = async (job, errorMessage) => {
  const attempts = Number(job.attempts || 0) + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await db.query(
      `UPDATE email_queue
          SET status = 'failed',
              attempts = $2,
              last_error = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [job.id, attempts, errorMessage]
    );
    return;
  }

  const delayMinutes = Math.pow(2, attempts);
  await db.query(
    `UPDATE email_queue
        SET status = 'pending',
            attempts = $2,
            last_error = $3,
            next_run_at = NOW() + (interval '1 minute' * $4),
            updated_at = NOW()
      WHERE id = $1`,
    [job.id, attempts, errorMessage, delayMinutes]
  );
};

exports.release = async (id) => {
  await db.query(
    `UPDATE email_queue
        SET status = 'pending',
            updated_at = NOW()
      WHERE id = $1`,
    [id]
  );
};
