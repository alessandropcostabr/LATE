CREATE TABLE recados (
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
            );
CREATE TABLE sqlite_sequence(name,seq);
CREATE INDEX idx_data_ligacao ON recados(data_ligacao);
CREATE INDEX idx_destinatario ON recados(destinatario);
CREATE INDEX idx_situacao ON recados(situacao);
CREATE INDEX idx_remetente_nome ON recados(remetente_nome);
CREATE INDEX idx_criado_em ON recados(criado_em);
