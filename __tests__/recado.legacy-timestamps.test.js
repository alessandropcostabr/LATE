process.env.DB_PATH = '';

const dbManager = require('../config/database');
let RecadoModel;

beforeEach(() => {
  dbManager.close();
  const db = dbManager.getDatabase();
  db.exec(`
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
      situacao VARCHAR(20) DEFAULT 'pendente',
      observacoes TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      updated_by INTEGER
    );
  `);
  delete require.cache[require.resolve('../models/recado')];
  RecadoModel = require('../models/recado');
  RecadoModel.db = db;
});

afterEach(() => {
  dbManager.close();
});

test('CRUD operations work with legacy timestamp columns', () => {
  const created = RecadoModel.create({
    data_ligacao: '2024-03-01',
    hora_ligacao: '08:00',
    destinatario: 'Alice',
    remetente_nome: 'Bob',
    assunto: 'Teste'
  });
  expect(created).toHaveProperty('id');
  const fetched = RecadoModel.findById(created.id);
  expect(fetched.destinatario).toBe('Alice');

  const updated = RecadoModel.update(created.id, { ...created, situacao: 'resolvido' });
  expect(updated.situacao).toBe('resolvido');

  const ok = RecadoModel.delete(created.id);
  expect(ok).toBe(true);
  expect(RecadoModel.findById(created.id)).toBeUndefined();
});

test('ordering works with legacy timestamp columns', () => {
  const db = RecadoModel.db;
  db.exec(`
    INSERT INTO recados (data_ligacao, hora_ligacao, destinatario, remetente_nome, assunto, criado_em, atualizado_em)
    VALUES ('2024-01-01','09:00','Dest1','Rem1','A','2024-01-01 10:00:00','2024-01-01 10:00:00'),
           ('2024-01-02','10:00','Dest2','Rem2','B','2024-01-02 11:00:00','2024-01-02 11:00:00');
  `);
  const byCreated = RecadoModel.findAll({ orderBy: 'criado_em', orderDir: 'DESC' });
  expect(byCreated[0].assunto).toBe('B');
  const byUpdated = RecadoModel.findAll({ orderBy: 'atualizado_em', orderDir: 'ASC' });
  expect(byUpdated[0].assunto).toBe('A');
});
