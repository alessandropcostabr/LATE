const dbManager = require('../config/database');

class RecadoModel {
    constructor() {
        this.db = dbManager.getDatabase();
    }

    // Criar novo recado
    create(recadoData) {
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
        const stmt = this.db.prepare('SELECT * FROM recados WHERE id = ?');
        return stmt.get(id);
    }

    // Listar todos com filtros
    findAll(filters = {}) {
        let query = 'SELECT * FROM recados WHERE 1=1';
        const params = [];

        // Filtro por data
        if (filters.data_inicio) {
            query += ' AND data_ligacao >= ?';
            params.push(filters.data_inicio);
        }
        if (filters.data_fim) {
            query += ' AND data_ligacao <= ?';
            params.push(filters.data_fim);
        }

        // Filtro por destinatário
        if (filters.destinatario) {
            query += ' AND destinatario LIKE ?';
            params.push(`%${filters.destinatario}%`);
        }

        // Filtro por situação
        if (filters.situacao) {
            query += ' AND situacao = ?';
            params.push(filters.situacao);
        }

        // Filtro por remetente
        if (filters.remetente) {
            query += ' AND remetente_nome LIKE ?';
            params.push(`%${filters.remetente}%`);
        }

        // Busca geral
        if (filters.busca) {
            query += ` AND (
                remetente_nome LIKE ? OR 
                destinatario LIKE ? OR 
                assunto LIKE ? OR 
                observacoes LIKE ?
            )`;
            const searchTerm = `%${filters.busca}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Ordenação
        const orderBy = filters.orderBy || 'criado_em';
        const orderDir = filters.orderDir || 'DESC';
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
        let query = 'SELECT COUNT(*) as total FROM recados WHERE 1=1';
        const params = [];

        // Reaplicar filtros usados em findAll para manter consistência
        if (filters.data_inicio) {
            query += ' AND data_ligacao >= ?';
            params.push(filters.data_inicio);
        }
        if (filters.data_fim) {
            query += ' AND data_ligacao <= ?';
            params.push(filters.data_fim);
        }
        if (filters.destinatario) {
            query += ' AND destinatario LIKE ?';
            params.push(`%${filters.destinatario}%`);
        }
        if (filters.situacao) {
            query += ' AND situacao = ?';
            params.push(filters.situacao);
        }
        if (filters.remetente) {
            query += ' AND remetente_nome LIKE ?';
            params.push(`%${filters.remetente}%`);
        }
        if (filters.busca) {
            query += ` AND (
                remetente_nome LIKE ? OR 
                destinatario LIKE ? OR 
                assunto LIKE ? OR 
                observacoes LIKE ?
            )`;
            const searchTerm = `%${filters.busca}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const stmt = this.db.prepare(query);
        const row = stmt.get(...params);
        return row ? row.total : 0;
    }

    // Atualizar recado
    update(id, recadoData) {
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
        const stmt = this.db.prepare('DELETE FROM recados WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // Estatísticas
    getStats() {
        const totalStmt     = this.db.prepare('SELECT COUNT(*) as total FROM recados');
        const pendenteStmt  = this.db.prepare("SELECT COUNT(*) as total FROM recados WHERE situacao = 'pendente'");
        const andamentoStmt = this.db.prepare("SELECT COUNT(*) as total FROM recados WHERE situacao = 'em_andamento'");
        const resolvidoStmt = this.db.prepare("SELECT COUNT(*) as total FROM recados WHERE situacao = 'resolvido'");

        return {
            total:     totalStmt.get().total,
            pendentes: pendenteStmt.get().total,
            andamento: andamentoStmt.get().total,
            resolvidos: resolvidoStmt.get().total,
        };
    }

    // Estatísticas agrupadas por destinatário
    getStatsByDestinatario() {
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
        const stmt = this.db.prepare(`
            SELECT * FROM recados
            ORDER BY criado_em DESC
            LIMIT ?
        `);
        return stmt.all(limit);
    }
}

module.exports = new RecadoModel();
