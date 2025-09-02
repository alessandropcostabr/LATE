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
            'criado_em',
            'atualizado_em'
        ];
        this.allowedOrderDir = ['ASC', 'DESC'];
    }

    _ensureDb() {
        if (!this.db || !this.db.open) {
            throw new Error('Database connection is not initialized');
        }
    }

    // Helper para construir filtros reutilizáveis
    _buildFilterQuery(filters = {}) {
        let clause = '';
        const params = [];

        // Filtro por data
        if (filters.data_inicio) {
            clause += ' AND data_ligacao >= ?';
            params.push(filters.data_inicio);
        }
        if (filters.data_fim) {
            clause += ' AND data_ligacao <= ?';
            params.push(filters.data_fim);
        }

        // Filtro por destinatário
        if (filters.destinatario) {
            clause += ' AND destinatario LIKE ?';
            params.push(`%${filters.destinatario}%`);
        }

        // Filtro por situação
        if (filters.situacao) {
            clause += ' AND situacao = ?';
            params.push(filters.situacao);
        }

        // Filtro por remetente
        if (filters.remetente) {
            clause += ' AND remetente_nome LIKE ?';
            params.push(`%${filters.remetente}%`);
        }

        // Busca geral
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

    // Criar novo recado
    create(recadoData) {
        this._ensureDb();
        const stmt = this.db.prepare(`
            INSERT INTO recados (
                data_ligacao, hora_ligacao, destinatario, remetente_nome,
                remetente_telefone, remetente_email, horario_retorno,
                assunto, situacao, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            recadoData.observacoes || null
        );

        return this.findById(result.lastInsertRowid);
    }

    // Buscar por ID
    findById(id) {
        this._ensureDb();
        const stmt = this.db.prepare('SELECT * FROM recados WHERE id = ?');
        return stmt.get(id);
    }

    // Listar todos com filtros
    findAll(filters = {}) {
        this._ensureDb();
        const { clause, params } = this._buildFilterQuery(filters);
        let query = `SELECT * FROM recados WHERE 1=1${clause}`;

        // Ordenação
        const orderBy = this.allowedOrderBy.includes(filters.orderBy)
            ? filters.orderBy
            : 'criado_em';
        const dir = (filters.orderDir || '').toUpperCase();
        const orderDir = this.allowedOrderDir.includes(dir) ? dir : 'DESC';
        query += ` ORDER BY ${orderBy} ${orderDir}`;

        // Paginação
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

    // Contar registros com filtros
    // Este método pode não existir em versões antigas do sistema. Caso
    // necessite adicionar suporte à contagem de registros, implemente aqui.
    count(filters = {}) {
        this._ensureDb();
        const { clause, params } = this._buildFilterQuery(filters);
        const query = `SELECT COUNT(*) as total FROM recados WHERE 1=1${clause}`;
        const stmt = this.db.prepare(query);
        const row = stmt.get(...params);
        return row ? row.total : 0;
    }

    // Atualizar recado
    update(id, recadoData) {
        this._ensureDb();
        const stmt = this.db.prepare(`
            UPDATE recados SET
                data_ligacao = ?, hora_ligacao = ?, destinatario = ?,
                remetente_nome = ?, remetente_telefone = ?, remetente_email = ?,
                horario_retorno = ?, assunto = ?, situacao = ?, observacoes = ?,
                atualizado_em = CURRENT_TIMESTAMP
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
            id
        );

        return result.changes > 0 ? this.findById(id) : null;
    }

    // Atualizar apenas situação
    updateSituacao(id, situacao) {
        this._ensureDb();
        const stmt = this.db.prepare(`
            UPDATE recados SET
                situacao = ?,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        const result = stmt.run(situacao, id);
        return result.changes > 0;
    }

    // Excluir recado
    delete(id) {
        this._ensureDb();
        const stmt = this.db.prepare('DELETE FROM recados WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // Estatísticas
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
            total:        row.total,
            pendente:     row.pendente,
            em_andamento: row.em_andamento,
            resolvido:    row.resolvido,
        };
    }

    // Estatísticas agrupadas por destinatário
    getStatsByDestinatario() {
        this._ensureDb();
        const stmt = this.db.prepare(`
            SELECT destinatario, COUNT(*) as total
            FROM recados
            GROUP BY destinatario
            ORDER BY total DESC
        `);
        return stmt.all();
    }

    // Últimos N recados
    getRecentes(limit = 10) {
        this._ensureDb();
        const stmt = this.db.prepare(`
            SELECT * FROM recados
            ORDER BY criado_em DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

module.exports = new RecadoModel();
