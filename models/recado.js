const dbManager = require('../config/database');

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
    let clause = '';
    const params = [];

    if (filters.data_inicio) {
      clause += ' AND data_ligacao >= ?';
      params.push(filters.data_inicio);
    }
    if (filters.data_fim) {
      clause += ' AND data_ligacao <= ?';
      params.push(filters.data_fim);
    }

    if (filters.destinatario) {
      clause += ' AND destinatario LIKE ?';
      params.push(`%${filters.destinatario}%`);
    }

    if (filters.situacao) {
      clause += ' AND situacao = ?';
      params.push(filters.situacao);
    }

    if (filters.remetente) {
      clause += ' AND remetente_nome LIKE ?';
      params.push(`%${filters.remetente}%`);
    }

    if (filters.created_by || filters.user_id || filters.userId) {
      const user = filters.created_by || filters.user_id || filters.userId;
      clause += ' AND created_by = ?';
      params.push(user);
    }

    if (filters.busca) {
      clause += ` AND (
        remetente_nome LIKE ? OR
        destinatario LIKE ? OR
        assunto LIKE ? OR
        observacoes LIKE ?
      )`;
      const searchTerm = `%${filters.busca}%`;
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
    const { clause, params } = this._buildFilterQuery(filters);
    let query = `SELECT * FROM recados WHERE 1=1${clause}`;
    const orderBy = this.allowedOrderBy.includes(filters.orderBy)
      ? filters.orderBy
      : 'created_at';
    const dir = (filters.orderDir || '').toUpperCase();
    const orderDir = this.allowedOrderDir.includes(dir) ? dir : 'DESC';
    query += ` ORDER BY ${orderBy} ${orderDir}`;
    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(filters.limit));
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(parseInt(filters.offset));
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
