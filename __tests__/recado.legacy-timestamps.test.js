process.env.NODE_ENV = 'test';
process.env.DB_PATH = '';

let dbManager;
let MessageModel;

const SCHEMAS = [
  {
    label: 'modern messages schema',
    setupSql: `
      CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_date TEXT NOT NULL,
        call_time TEXT NOT NULL,
        recipient TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        sender_phone TEXT,
        sender_email TEXT,
        subject TEXT NOT NULL,
        message TEXT,
        status TEXT DEFAULT 'pending',
        callback_time TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,
    insertRecentSql: `
      INSERT INTO messages (call_date, call_time, recipient, sender_name, subject, message, status, created_at, updated_at)
      VALUES ('2024-01-01','09:00','Dest1','Rem1','A','Mensagem A','pending','2024-01-01 10:00:00','2024-01-01 10:00:00'),
             ('2024-01-02','10:00','Dest2','Rem2','B','Mensagem B','resolved','2024-01-02 11:00:00','2024-01-02 11:00:00');
    `,
  },
  {
    label: 'legacy recados schema',
    setupSql: `
      CREATE TABLE recados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data_ligacao TEXT NOT NULL,
        hora_ligacao TEXT NOT NULL,
        destinatario TEXT NOT NULL,
        remetente_nome TEXT NOT NULL,
        remetente_telefone TEXT,
        remetente_email TEXT,
        assunto TEXT NOT NULL,
        mensagem TEXT NOT NULL,
        situacao TEXT DEFAULT 'pendente',
        horario_retorno TEXT,
        observacoes TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,
    insertRecentSql: `
      INSERT INTO recados (data_ligacao, hora_ligacao, destinatario, remetente_nome, assunto, mensagem, situacao, horario_retorno, observacoes, criado_em, atualizado_em)
      VALUES ('2024-01-01','09:00','Dest1','Rem1','A','Mensagem A','pendente','Manhã','Obs A','2024-01-01 10:00:00','2024-01-01 10:00:00'),
             ('2024-01-02','10:00','Dest2','Rem2','B','Mensagem B','resolvido','Tarde','Obs B','2024-01-02 11:00:00','2024-01-02 11:00:00');
    `,
  },
];

describe.each(SCHEMAS)('$label', schema => {
  beforeEach(() => {
    jest.resetModules();
    dbManager = require('../config/database');
    dbManager.close();
    const db = dbManager.getDatabase();
    db.exec(`
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS recados;
    `);
    db.exec(schema.setupSql);
    MessageModel = require('../models/message');
  });

  afterEach(() => {
    dbManager.close();
  });

  test('CRUD operations work with timestamp columns', () => {
    const id = MessageModel.create({
      call_date: '2024-03-01',
      call_time: '08:00',
      recipient: 'Alice',
      sender_name: 'Bob',
      sender_phone: '(11) 99999-9999',
      sender_email: 'bob@example.com',
      subject: 'Teste',
      message: 'Mensagem de teste',
      callback_time: 'Após 12h',
      notes: 'Observações iniciais'
    });
    expect(typeof id).toBe('number');

    const fetched = MessageModel.findById(id);
    expect(fetched.recipient).toBe('Alice');
    expect(fetched.message).toBe('Mensagem de teste');
    expect(fetched.callback_time).toBe('Após 12h');
    expect(fetched.notes).toBe('Observações iniciais');
    expect(fetched.status).toBe('pending');

    const updatedOk = MessageModel.update(id, {
      call_date: '2024-03-01',
      call_time: '09:15',
      recipient: 'Alice',
      sender_name: 'Bob',
      sender_phone: '(11) 98888-7777',
      sender_email: 'bob@update.com',
      subject: 'Teste',
      message: 'Mensagem atualizada',
      callback_time: 'Após 18h',
      notes: 'Observações atualizadas',
      status: 'resolved'
    });
    expect(updatedOk).toBe(true);

    const updated = MessageModel.findById(id);
    expect(updated.status).toBe('resolved');
    expect(updated.message).toBe('Mensagem atualizada');
    expect(updated.callback_time).toBe('Após 18h');
    expect(updated.notes).toBe('Observações atualizadas');

    const removed = MessageModel.remove(id);
    expect(removed).toBe(true);
    expect(MessageModel.findById(id)).toBeNull();
  });

  test('list keeps newest first with timestamps', () => {
    const db = dbManager.getDatabase();
    db.exec(schema.insertRecentSql);

    const list = MessageModel.list({ limit: 5 });
    const subjects = list.map(item => item.subject);
    expect(subjects).toEqual(['B', 'A']);
    expect(list[0].status).toBe('resolved');
    expect(list[1].status).toBe('pending');
  });
});
