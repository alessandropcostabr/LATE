const dbManager = require('../config/database');
const isPlainObject = v => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

class RecadoModel {
  constructor() {
    this.db = dbManager.getDatabase();
    this.allowedOrderBy = [
      'id',
      'data_ligacao',
      'hora_ligacao',
      'destinatario',
      'remetente_nome',
      'situacao',
      'created_at',
      'updated_at'
    ];
    this.allowedOrderDir = ['ASC', 'DESC'];
  }

  _ensureDb() {
    if (!this.db || !this.db.open) {
      throw new Error('Database connection is not initialized');
    }
  }

  _buildFilterQuery(filters = {}) {
    const q = isPlainObject(filters) ? filters : {};
    let clause = '';
    const params = [];

    const like = (field, value) => {
      clause += ` AND ${field} LIKE ?`;
      params.push(`%${value}%`);
    };

    if (q.data_inicio) {
      clause += ' AND data_ligacao >= ?';
      params.push(q.data_inicio);
    }
    if (q.data_fim) {
      clause += ' AND data_ligacao <= ?';
      params.push(q.data_fim);
    }
    if (q.destinatario) like('destinatario', q.destinatario);
    if (q.situacao && ['pendente','em_andamento','resolvido'].includes(q.situacao)) {
      clause += ' AND situacao = ?';
      params.push(q.situacao);
    }
    if (q.remetente_nome) like('remetente_nome', q.remetente_nome);
    if (q.remetente) like('remetente_nome', q.remetente);
    if (q.created_by || q.user_id || q.userId) {
      const user = q.created_by || q.user_id || q.userId;
      clause += ' AND created_by = ?';
      params.push(user);
    }
    if (q.busca) {
      const searchTerm = `%${q.busca}%`;
      clause += ' AND (remetente_nome LIKE ? OR destinatario LIKE ? OR assunto LIKE ? OR observacoes LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    return { clause, params };
  }

  create(recadoData) {
    this._ensureDb();
    const creator = recadoData.created_by || recadoData.user_id || recadoData.userId || null;
    const updater = recadoData.updated_by || creator;
    const stmt = this.db.prepare(`
      INSERT INTO recados (
        data_ligacao, hora_ligacao, destinatario, remetente_nome,
        remetente_telefone, remetente_email, horario_retorno,
        assunto, situacao, observacoes, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      recadoData.data_ligacao,
      recadoData.hora_ligacao,
      recadoData.destinatario,
      recadoData.remetente_nome,
      recadoData.remetente_telefone || null,
      recadoData.remetente_email || null,
      recadoData.horario_retorno || null,
      recadoData.assunto,
      recadoData.situacao || 'pendente',
      recadoData.observacoes || null,
      creator,
      updater
    );
    return this.findById(result.lastInsertRowid);
  }

  findById(id) {
    this._ensureDb();
    const stmt = this.db.prepare('SELECT * FROM recados WHERE id = ?');
    return stmt.get(id);
  }

  findAll(filters = {}) {
    this._ensureDb();
    const f = isPlainObject(filters) ? { ...filters } : {};
    const { limit: lim, offset: off, orderBy, orderDir, ...rest } = f;
    const { clause, params } = this._buildFilterQuery(rest);
    let query = `SELECT * FROM recados WHERE 1=1${clause}`;
    let requestedOrder = orderBy;
    if (requestedOrder === 'criado_em') requestedOrder = 'created_at';
    const orderByFinal = this.allowedOrderBy.includes(requestedOrder)
      ? requestedOrder
      : 'created_at';
    const dir = (orderDir || '').toUpperCase();
    const orderDirFinal = this.allowedOrderDir.includes(dir) ? dir : 'DESC';
    query += ` ORDER BY ${orderByFinal} ${orderDirFinal}`;
    const limit = parseInt(lim, 10);
    const offset = parseInt(off, 10);
    if (Number.isFinite(limit)) {
      query += ' LIMIT ?';
      params.push(limit);
      if (Number.isFinite(offset)) {
        query += ' OFFSET ?';
        params.push(offset);
      }
    }
    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  count(filters = {}) {
    this._ensureDb();
    const { clause, params } = this._buildFilterQuery(filters);
    const query = `SELECT COUNT(*) as total FROM recados WHERE 1=1${clause}`;
    const stmt = this.db.prepare(query);
    const row = stmt.get(...params);
    return row ? row.total : 0;
  }

  update(id, recadoData) {
    this._ensureDb();
    const updater = recadoData.updated_by || recadoData.user_id || recadoData.userId || null;
    const stmt = this.db.prepare(`
      UPDATE recados SET
        data_ligacao = ?, hora_ligacao = ?, destinatario = ?,
        remetente_nome = ?, remetente_telefone = ?, remetente_email = ?,
        horario_retorno = ?, assunto = ?, situacao = ?, observacoes = ?,
        updated_at = CURRENT_TIMESTAMP, updated_by = ?
      WHERE id = ?
    `);
    const result = stmt.run(
      recadoData.data_ligacao,
      recadoData.hora_ligacao,
      recadoData.destinatario,
      recadoData.remetente_nome,
      recadoData.remetente_telefone || null,
      recadoData.remetente_email || null,
      recadoData.horario_retorno || null,
      recadoData.assunto,
      recadoData.situacao,
      recadoData.observacoes || null,
      updater,
      id
    );
    return result.changes > 0 ? this.findById(id) : null;
  }

  updateSituacao(id, situacao, userId = null) {
    this._ensureDb();
    const stmt = this.db.prepare(`
      UPDATE recados SET
        situacao = ?,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = ?
      WHERE id = ?
    `);
    const result = stmt.run(situacao, userId, id);
    return result.changes > 0;
  }

  delete(id) {
    this._ensureDb();
    const stmt = this.db.prepare('DELETE FROM recados WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  getStats() {
    this._ensureDb();
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN situacao = 'pendente' THEN 1 ELSE 0 END)      AS pendente,
        SUM(CASE WHEN situacao = 'em_andamento' THEN 1 ELSE 0 END) AS em_andamento,
        SUM(CASE WHEN situacao = 'resolvido' THEN 1 ELSE 0 END)    AS resolvido
      FROM recados
    `);
    const row = stmt.get();
    return {
      total: row.total,
      pendente: row.pendente,
      em_andamento: row.em_andamento,
      resolvido: row.resolvido,
    };
  }

  getStatsByDestinatario() {
    this._ensureDb();
    const stmt = this.db.prepare(`
      SELECT
        destinatario,
        COUNT(*) AS total,
        SUM(CASE WHEN situacao = 'pendente' THEN 1 ELSE 0 END)      AS pendente,
        SUM(CASE WHEN situacao = 'em_andamento' THEN 1 ELSE 0 END) AS em_andamento,
        SUM(CASE WHEN situacao = 'resolvido' THEN 1 ELSE 0 END)    AS resolvido
      FROM recados
      GROUP BY destinatario
      ORDER BY total DESC
    `);
    return stmt.all();
  }

  reportByMonth() {
    this._ensureDb();
    const stmt = this.db.prepare(`
      SELECT strftime('%Y-%m', data_ligacao) AS month, COUNT(*) AS total
      FROM recados
      GROUP BY month
      ORDER BY month
    `);
    return stmt.all();
  }

  reportByStatus() {
    this._ensureDb();
    const stmt = this.db.prepare(`
      SELECT situacao AS status, COUNT(*) AS total
      FROM recados
      GROUP BY situacao
      ORDER BY status
    `);
    return stmt.all();
  }

  reportByResponsavel() {
    this._ensureDb();
    const stmt = this.db.prepare(`
      SELECT u.id AS user_id, u.name, u.email, COUNT(r.id) AS total
      FROM recados r
      JOIN users u ON r.created_by = u.id
      GROUP BY r.created_by
      ORDER BY total DESC
    `);
    return stmt.all();
  }

  getRecentes(limit = 10) {
    this._ensureDb();
    const stmt = this.db.prepare(`
      SELECT * FROM recados
      ORDER BY created_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }
}

module.exports = new RecadoModel();
