// models/notificationSettings.js
// Armazena e atualiza preferências globais de notificações.

const db = require('../config/database');

const DEFAULT_SETTINGS = {
  pending_enabled: true,
  pending_interval_hours: 24,
  in_progress_enabled: true,
  in_progress_interval_hours: 48,
};

function mapRow(row) {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    pending_enabled: row.pending_enabled === true,
    pending_interval_hours: Number(row.pending_interval_hours) || DEFAULT_SETTINGS.pending_interval_hours,
    in_progress_enabled: row.in_progress_enabled === true,
    in_progress_interval_hours: Number(row.in_progress_interval_hours) || DEFAULT_SETTINGS.in_progress_interval_hours,
    updated_at: row.updated_at || null,
  };
}

class NotificationSettingsModel {
  async getSettings(client = db) {
    try {
      const { rows } = await client.query('SELECT * FROM notification_settings ORDER BY id ASC LIMIT 1');
      return mapRow(rows?.[0]);
    } catch (err) {
      if (err?.code === '42P01') {
        // tabela ausente (migração não aplicada) → usa defaults
        return { ...DEFAULT_SETTINGS };
      }
      throw err;
    }
  }

  async updateSettings(settings = {}) {
    const payload = {
      pending_enabled: settings.pending_enabled === true,
      pending_interval_hours: Math.max(1, Number(settings.pending_interval_hours) || DEFAULT_SETTINGS.pending_interval_hours),
      in_progress_enabled: settings.in_progress_enabled === true,
      in_progress_interval_hours: Math.max(1, Number(settings.in_progress_interval_hours) || DEFAULT_SETTINGS.in_progress_interval_hours),
    };

    let rows;
    try {
      ({ rows } = await db.query('SELECT id FROM notification_settings ORDER BY id ASC LIMIT 1'));
    } catch (err) {
      if (err?.code === '42P01') {
        throw new Error('Tabela notification_settings ausente. Execute as migrações antes de salvar.');
      }
      throw err;
    }

    if (rows?.[0]?.id) {
      const { rows: updated } = await db.query(`
        UPDATE notification_settings
           SET pending_enabled = $1,
               pending_interval_hours = $2,
               in_progress_enabled = $3,
               in_progress_interval_hours = $4,
               updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
     RETURNING *
      `, [
        payload.pending_enabled,
        payload.pending_interval_hours,
        payload.in_progress_enabled,
        payload.in_progress_interval_hours,
        rows[0].id,
      ]);
      return mapRow(updated?.[0]);
    }

    const insertSql = `
      INSERT INTO notification_settings (pending_enabled, pending_interval_hours, in_progress_enabled, in_progress_interval_hours, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const { rows: inserted } = await db.query(insertSql, [
      payload.pending_enabled,
      payload.pending_interval_hours,
      payload.in_progress_enabled,
      payload.in_progress_interval_hours,
    ]);
    return mapRow(inserted?.[0]);
  }
}

module.exports = new NotificationSettingsModel();
