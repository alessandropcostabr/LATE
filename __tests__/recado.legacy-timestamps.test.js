process.env.DB_PATH = '';

const dbManager = require('../config/database');
let MessageModel;

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
      mensagem TEXT,
      situacao VARCHAR(20) DEFAULT 'pendente',
      observacoes TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      updated_by INTEGER
    );
  `);
  delete require.cache[require.resolve('../models/message')];
  MessageModel = require('../models/message');
});

afterEach(() => {
  dbManager.close();
});

test('CRUD operations work with legacy timestamp columns', () => {
  const id = MessageModel.create({
    call_date: '2024-03-01',
    call_time: '08:00',
    recipient: 'Alice',
    sender_name: 'Bob',
    subject: 'Teste',
    message: 'Mensagem de teste'
  });
  expect(typeof id).toBe('number');

  const fetched = MessageModel.findById(id);
  expect(fetched.recipient).toBe('Alice');
  expect(fetched.status).toBe('pending');

  const updatedOk = MessageModel.update(id, {
    call_date: '2024-03-01',
    call_time: '09:15',
    recipient: 'Alice',
    sender_name: 'Bob',
    subject: 'Teste',
    message: 'Mensagem atualizada',
    status: 'resolved'
  });
  expect(updatedOk).toBe(true);

  const updated = MessageModel.findById(id);
  expect(updated.status).toBe('resolved');

  const removed = MessageModel.remove(id);
  expect(removed).toBe(true);
  expect(MessageModel.findById(id)).toBeNull();
});

test('list keeps newest first even with legacy timestamps', () => {
  const db = dbManager.getDatabase();
  db.exec(`
    INSERT INTO recados (data_ligacao, hora_ligacao, destinatario, remetente_nome, assunto, mensagem, situacao, criado_em, atualizado_em)
    VALUES ('2024-01-01','09:00','Dest1','Rem1','A','Mensagem A','pendente','2024-01-01 10:00:00','2024-01-01 10:00:00'),
           ('2024-01-02','10:00','Dest2','Rem2','B','Mensagem B','resolvido','2024-01-02 11:00:00','2024-01-02 11:00:00');
  `);

  const list = MessageModel.list({ limit: 5 });
  const subjects = list.map(item => item.subject);
  expect(subjects).toEqual(['B', 'A']);
  expect(list[0].status).toBe('resolved');
  expect(list[1].status).toBe('pending');
});
