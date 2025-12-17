const db = require('../config/database');

function ph(i) { return `$${i}`; }

class MessageSendEventModel {
  async findByIdempotency(source, idempotencyKey) {
    const sql = `SELECT * FROM message_send_events WHERE source = ${ph(1)} AND idempotency_key = ${ph(2)} LIMIT 1`;
    const { rows } = await db.query(sql, [source, idempotencyKey]);
    return rows?.[0] || null;
  }

  async insertIdempotent(event) {
    const sql = `
      INSERT INTO message_send_events (
        source, session_id, arquivo, phone_e164, nome, status, mensagem_final,
        failure_reason, template_id, enviado_em, sender_version, lead_data_hash,
        contexto_versao, api_payload_version, idempotency_key, payload_raw
      ) VALUES (
        ${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, ${ph(5)}, ${ph(6)}, ${ph(7)},
        ${ph(8)}, ${ph(9)}, ${ph(10)}, ${ph(11)}, ${ph(12)},
        ${ph(13)}, ${ph(14)}, ${ph(15)}, ${ph(16)}
      )
      ON CONFLICT (source, idempotency_key) DO NOTHING
      RETURNING *
    `;

    const params = [
      event.source,
      event.session_id || null,
      event.arquivo || null,
      event.phone_e164 || null,
      event.nome || null,
      event.status || null,
      event.mensagem_final || null,
      event.failure_reason || null,
      event.template_id || null,
      event.enviado_em || null,
      event.sender_version || null,
      event.lead_data_hash || null,
      event.contexto_versao || null,
      event.api_payload_version || null,
      event.idempotency_key,
      event.payload_raw ? JSON.stringify(event.payload_raw) : null,
    ];

    const { rows } = await db.query(sql, params);
    if (rows?.[0]) {
      return { row: rows[0], inserted: true };
    }

    const existing = await this.findByIdempotency(event.source, event.idempotency_key);
    return { row: existing, inserted: false };
  }

  async list({ source = 'sender-whatsapp', status, phone, from, to } = {}, { limit = 50, offset = 0 } = {}) {
    const conditions = ['source = $1'];
    const params = [source];
    let idx = params.length + 1;

    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (phone) { conditions.push(`phone_e164 ILIKE $${idx++}`); params.push(`%${phone}%`); }
    if (from) { conditions.push(`created_at >= $${idx++}`); params.push(new Date(from)); }
    if (to) { conditions.push(`created_at <= $${idx++}`); params.push(new Date(to)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT id, source, session_id, arquivo, phone_e164, nome, status, mensagem_final,
             failure_reason, template_id, enviado_em, sender_version, lead_data_hash,
             contexto_versao, api_payload_version, idempotency_key, payload_raw, created_at
        FROM message_send_events
        ${where}
    ORDER BY created_at DESC, id DESC
       LIMIT $${idx}
      OFFSET $${idx + 1}
    `;
    params.push(limit, offset);
    const { rows } = await db.query(sql, params);
    return rows || [];
  }
}

module.exports = new MessageSendEventModel();
