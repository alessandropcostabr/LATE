const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
    constructor() {
        // Criar diretório de dados se não existir
        const fs = require('fs');
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        const dbPath = path.join(__dirname, '..', 'data', 'recados.db');
        this.db = new Database(dbPath);
        this.init();
    }

    init() {

        // Configurações do SQLite
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        
        // Criar tabelas
        this.createTables();
        this.createIndexes();
    }

    createTables() {
        const createRecadosTable = `
            CREATE TABLE IF NOT EXISTS recados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data_ligacao DATE NOT NULL,
                hora_ligacao TIME NOT NULL,
                destinatario VARCHAR(255) NOT NULL,
                remetente_nome VARCHAR(255) NOT NULL,
                remetente_telefone VARCHAR(20),
                remetente_email VARCHAR(255),
                horario_retorno VARCHAR(100),
                assunto TEXT NOT NULL,
                situacao VARCHAR(20) DEFAULT 'pendente' CHECK (situacao IN ('pendente', 'em_andamento', 'resolvido')),
                observacoes TEXT,
                criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.exec(createRecadosTable);
    }

    createIndexes() {
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_data_ligacao ON recados(data_ligacao)',
            'CREATE INDEX IF NOT EXISTS idx_destinatario ON recados(destinatario)',
            'CREATE INDEX IF NOT EXISTS idx_situacao ON recados(situacao)',
            'CREATE INDEX IF NOT EXISTS idx_remetente_nome ON recados(remetente_nome)',
            'CREATE INDEX IF NOT EXISTS idx_criado_em ON recados(criado_em)'
        ];

        indexes.forEach(index => {
            this.db.exec(index);
        });
    }

    getDatabase() {
        return this.db;
    }

    close() {
        this.db.close();
    }

    // Método para backup
    backup(backupPath) {
        this.db.backup(backupPath);
    }
}

module.exports = new DatabaseManager();

