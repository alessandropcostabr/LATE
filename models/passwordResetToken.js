// models/passwordResetToken.js
// Armazena e valida tokens de redefinição de senha.

const crypto = require('crypto');
const db = require('../config/database');

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getExecutor(client) {
  return client && typeof client.query === 'function' ? client : db;
}

class PasswordResetTokenModel {
  constructor() {
    this.DEFAULT_TTL_MINUTES = 60;
  }

  async purgeExpired({ client } = {}) {
    const executor = getExecutor(client);
    try {
      await executor.query(`
        DELETE FROM password_reset_tokens
         WHERE used_at IS NOT NULL
            OR expires_at <= NOW()
      `);
    } catch (err) {
      console.error('[passwordResetTokens] erro ao limpar tokens expirados:', err);
    }
  }

  async invalidateForUser(userId, { client } = {}) {
    const executor = getExecutor(client);
    await executor.query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1`,
      [userId],
    );
  }

  async createForUser(userId, { ttlMinutes } = {}) {
    if (!userId) {
      throw new Error('userId é obrigatório para gerar token de redefinição');
    }

    const minutes = Number.isFinite(ttlMinutes) && ttlMinutes > 0
      ? ttlMinutes
      : this.DEFAULT_TTL_MINUTES;

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    await this.invalidateForUser(userId);
    await this.purgeExpired();

    await db.query(`
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `, [userId, tokenHash, expiresAt]);

    return { token, expiresAt };
  }

  async findValidByToken(token, { client, forUpdate = false } = {}) {
    if (!token) return null;
    const executor = getExecutor(client);
    const tokenHash = hashToken(token);
    const sql = `
      SELECT id, user_id, expires_at, used_at, created_at
        FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY id DESC
       LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `;
    const { rows } = await executor.query(sql, [tokenHash]);
    return rows?.[0] || null;
  }

  async markUsed(id, { client } = {}) {
    if (!id) return false;
    const executor = getExecutor(client);
    const { rowCount } = await executor.query(`
      UPDATE password_reset_tokens
         SET used_at = NOW()
       WHERE id = $1
         AND used_at IS NULL
    `, [id]);
    return rowCount > 0;
  }
}

module.exports = new PasswordResetTokenModel();
