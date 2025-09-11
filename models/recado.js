// models/recado.js
// Compatível com esquemas que usam created_at/updated_at (en-US) ou criado_em/atualizado_em (pt-BR).
// Inclui whitelist e normalização de orderBy para evitar erros (ex.: "no such column: created_at") e mitigar SQLi.
// NÃO executa I/O fora do SQLite; não altera views/public.

const dbManager = require('../config/database');

const isPlainObject = (v) => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

class RecadoModel {
  constructor() {
    this.db = dbManager.getDatabase();
    // Colunas potencialmente ordenáveis (serão filtradas pelas realmente existentes)
    this.allowedOrderBy = [
      'id',
      'data_ligacao',
      'hora_ligacao',
      'destinatario',
      'remetente_nome',
      'situacao',
      'created_at', 'updated_at',
      'criado_em', 'atualizado_em'
    ];
    this.allowedOrderDir = ['ASC', 'DESC'];
  }

  _ensureDb() {
    if (!this.db) this.db = dbManager.getDatabase();
  }

  _tableColumns() {
    const rows = this.db.prepare('PRAGMA table_info(recados)').all();
    return new Set(rows.map(r => r.name));
  }

  // Resolve a melhor coluna de timestamp disponível para ORDER BY default
  _resolveTimestampColumn() {
    const names = this._tableColumns();
    const column = names.has('created_at')
      ? 'created_at'
      : names.has('criado_em')
        ? 'criado_em'
        : 'id'; // fallback estável
    return { column, names };
  }

  // Coluna de atualização (para UPDATE ... SET <updCol> = CURRENT_TIMESTAMP)
  _resolveUpdateColumn(names) {
    if (names.has('updated_at')) return 'updated_at';
    if (names.has('atualizado_em')) return 'atualizado_em';
    return null;
  }

  // Normaliza 'orderBy' com mapeamento created_at→criado_em e updated_at→atualizado_em quando apropriado
  _normalizeOrderBy(requested, names, fallback) {
    const map = { created_at: 'criado_em', updated_at: 'atualizado_em' };
    const req = String(requested || '').trim().toLowerCase();
    let candidate = req;
    if (map[req] && names.has(map[req]) && !names.has(req)) {
      candidate = map[req];
    }
    // Interseção entre allowed e colunas presentes
    const allowedPresent = this.allowedOrderBy.filter(c => names.has(c));
    if (!candidate) return fallback;
    return allowedPresent.includes(candidate) ? candidate : fallback;
  }

  // Constrói WHERE a partir de filtros conhecidos (data_inicio, data_fim, situacao, q)
  _buildFilterQuery(filters = {}) {
    const names = this._tableColumns();
    const where = [];
    const params = [];

    // Data: aplica sobre data_ligacao se existir; senão sobre timestamp de criação
    let dateCol = names.has('data_ligacao') ? 'data_ligacao' : (names.has('created_at') ? 'date(created_at)' : (names.has('criado_em') ? 'date(criado_em)' : null));
    if (filters.data_inicio && dateCol) {
      where.push(`${dateCol} >= ?`);
      params.push(String(filters.data_inicio));
    }
    if (filters.data_fim && dateCol) {
      where.push(`${dateCol} <= ?`);
      params.push(String(filters.data_fim));
    }

    if (filters.situacao) {
      where.push(`situacao = ?`);
      params.push(String(filters.situacao));
    }

    if (filters.destinatario) {
      where.push(`destinatario = ?`);
      params.push(String(filters.destinatario));
    }

    // Busca textual ampla
    if (filters.q) {
      const like = `%${String(filters.q).trim()}%`;
      const textCols = ['destinatario', 'remetente_nome', 'assunto', 'observacoes'];
      const present = textCols.filter(c => names.has(c));
      if (present.length) {
        const ors = present.map(c => `${c} LIKE ?`).join(' OR ');
        where.push(`(${ors})`);
        for (let i = 0; i < present.length; i++) params.push(like);
      }
    }

    const clause = where.length ? ` AND ${where.join(' AND ')}` : '';
    return { clause, params };
  }

  findAll(filters = {}) {
    this._ensureDb();
    const f = isPlainObject(filters) ? { ...filters } : {};
    const { limit, offset, orderBy, orderDir, ...rest } = f;
    const { clause, params } = this._buildFilterQuery(rest);

    const { column: defaultOrderCol, names } = this._resolveTimestampColumn();
    const orderByFinal = this._normalizeOrderBy(orderBy, names, defaultOrderCol);
    const dir = String(orderDir || '').toUpperCase();
    const orderDirFinal = this.allowedOrderDir.includes(dir) ? dir : 'DESC';

    let sql = `SELECT * FROM recados WHERE 1=1${clause} ORDER BY ${orderByFinal} ${orderDirFinal}`;
    const outParams = [...params];

    if (Number.isFinite(limit)) {
      sql += ' LIMIT ?';
      outParams.push(limit);
      if (Number.isFinite(offset)) {
        sql += ' OFFSET ?';
        outParams.push(offset);
      }
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(...outParams);
  }

  count(filters = {}) {
    this._ensureDb();
    const { clause, params } = this._buildFilterQuery(filters);
    const sql = `SELECT COUNT(*) AS total FROM recados WHERE 1=1${clause}`;
    const row = this.db.prepare(sql).get(...params);
    return row?.total || 0;
  }

  findById(id) {
    this._ensureDb();
    const stmt = this.db.prepare('SELECT * FROM recados WHERE id = ?');
    return stmt.get(id);
  }

  create(data) {
    this._ensureDb();
    if (!isPlainObject(data)) throw new Error('Dados inválidos');

    const names = this._tableColumns();
    // Campos conhecidos
    const candidates = {
      data_ligacao: data.data_ligacao,
      hora_ligacao: data.hora_ligacao,
      destinatario: data.destinatario,
      remetente_nome: data.remetente_nome,
      remetente_telefone: data.remetente_telefone,
      remetente_email: data.remetente_email,
      horario_retorno: data.horario_retorno,
      assunto: data.assunto,
      situacao: data.situacao || 'pendente',
      observacoes: data.observacoes,
      created_by: data.created_by ?? data.user_id ?? data.userId ?? null,
      updated_by: data.updated_by ?? null
    };

    // Seleciona apenas colunas existentes na tabela
    const cols = Object.keys(candidates).filter(k => names.has(k) && candidates[k] !== undefined);
    const placeholders = cols.map(_ => '?').join(', ');
    const values = cols.map(k => candidates[k]);

    if (!cols.length) throw new Error('Nada para inserir');
    const sql = `INSERT INTO recados (${cols.join(', ')}) VALUES (${placeholders})`;
    const info = this.db.prepare(sql).run(...values);
    return this.findById(info.lastInsertRowid);
  }

  update(id, data) {
    this._ensureDb();
    if (!isPlainObject(data)) throw new Error('Dados inválidos');

    const names = this._tableColumns();
    const updCol = this._resolveUpdateColumn(names);

    // Campos atualizáveis
    const candidates = {
      data_ligacao: data.data_ligacao,
      hora_ligacao: data.hora_ligacao,
      destinatario: data.destinatario,
      remetente_nome: data.remetente_nome,
      remetente_telefone: data.remetente_telefone,
      remetente_email: data.remetente_email,
      horario_retorno: data.horario_retorno,
      assunto: data.assunto,
      situacao: data.situacao,
      observacoes: data.observacoes,
      updated_by: data.updated_by ?? data.user_id ?? data.userId ?? null
    };

    const sets = [];
    const values = [];
    for (const [k, v] of Object.entries(candidates)) {
      if (v !== undefined && names.has(k)) {
        sets.push(`${k} = ?`);
        values.push(v);
      }
    }

    if (updCol) sets.push(`${updCol} = CURRENT_TIMESTAMP`);
    if (!sets.length) return false;

    const sql = `UPDATE recados SET ${sets.join(', ')} WHERE id = ?`;
    values.push(id);
    const info = this.db.prepare(sql).run(...values);
    return info.changes > 0;
  }

  delete(id) {
    this._ensureDb();
    const info = this.db.prepare('DELETE FROM recados WHERE id = ?').run(id);
    return info.changes > 0;
  }

  updateSituacao(id, situacao, userId = null) {
    this._ensureDb();
    const names = this._tableColumns();
    const updCol = this._resolveUpdateColumn(names);

    const parts = ['situacao = ?'];
    const values = [situacao];

    if (names.has('updated_by')) {
      parts.push('updated_by = ?');
      values.push(userId);
    }
    if (updCol) {
      parts.push(`${updCol} = CURRENT_TIMESTAMP`);
    }

    const sql = `UPDATE recados SET ${parts.join(', ')} WHERE id = ?`;
    values.push(id);
    const info = this.db.prepare(sql).run(...values);
    return info.changes > 0;
  }

  // Estatísticas por período (conta por situacao)
  getEstatisticasPorPeriodo({ data_inicio, data_fim } = {}) {
    this._ensureDb();
    const names = this._tableColumns();
    let dateCol = names.has('data_ligacao') ? 'data_ligacao' : (names.has('created_at') ? 'date(created_at)' : (names.has('criado_em') ? 'date(criado_em)' : null));

    let where = 'WHERE 1=1';
    const params = [];
    if (dateCol && data_inicio) { where += ` AND ${dateCol} >= ?`; params.push(String(data_inicio)); }
    if (dateCol && data_fim)    { where += ` AND ${dateCol} <= ?`; params.push(String(data_fim)); }

    const sql = `
      SELECT situacao, COUNT(*) AS total
      FROM recados
      ${where}
      GROUP BY situacao
      ORDER BY total DESC
    `;
    return this.db.prepare(sql).all(...params);
  }

  // Estatísticas por usuário (se coluna created_by existir)
  getEstatisticasPorUsuario({ data_inicio, data_fim } = {}) {
    this._ensureDb();
    const names = this._tableColumns();
    if (!names.has('created_by')) return [];

    let dateCol = names.has('data_ligacao') ? 'data_ligacao' : (names.has('created_at') ? 'date(created_at)' : (names.has('criado_em') ? 'date(criado_em)' : null));
    let where = 'WHERE 1=1';
    const params = [];
    if (dateCol && data_inicio) { where += ` AND ${dateCol} >= ?`; params.push(String(data_inicio)); }
    if (dateCol && data_fim)    { where += ` AND ${dateCol} <= ?`; params.push(String(data_fim)); }

    const sql = `
      SELECT created_by, COUNT(*) AS total
      FROM recados
      ${where}
      GROUP BY created_by
      ORDER BY total DESC
    `;
    return this.db.prepare(sql).all(...params);
  }

  getRecentes(limit = 10) {
    this._ensureDb();
    const { column: orderCol } = this._resolveTimestampColumn();
    const sql = `SELECT * FROM recados ORDER BY ${orderCol} DESC LIMIT ?`;
    return this.db.prepare(sql).all(limit);
  }
}

module.exports = new RecadoModel();
