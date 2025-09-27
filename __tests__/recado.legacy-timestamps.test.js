process.env.NODE_ENV = 'test';
process.env.DB_PATH = '';

const dbManager = require('../config/database');
const MessageModel = require('../models/message');

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    call_date TEXT,
    call_time TEXT,
    recipient TEXT,
    sender_name TEXT,
    sender_phone TEXT,
    sender_email TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    callback_time TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

async function resetDatabase() {
  const db = dbManager.getDatabase();
  db.exec(`
    DROP TABLE IF EXISTS messages;
  `);
  db.exec(CREATE_TABLE_SQL);
  return db;
}

describe('message model with modern schema', () => {
  beforeEach(async () => {
    await dbManager.close();
    await resetDatabase();
  });

  afterEach(async () => {
    await dbManager.close();
  });

  test('supports basic CRUD flow', async () => {
    const id = await MessageModel.create({
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

    const fetched = await MessageModel.findById(id);
    expect(fetched.recipient).toBe('Alice');
    expect(fetched.message).toBe('Mensagem de teste');
    expect(fetched.callback_time).toBe('Após 12h');
    expect(fetched.notes).toBe('Observações iniciais');
    expect(fetched.status).toBe('pending');

    const updatedOk = await MessageModel.update(id, {
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

    const updated = await MessageModel.findById(id);
    expect(updated.status).toBe('resolved');
    expect(updated.message).toBe('Mensagem atualizada');
    expect(updated.callback_time).toBe('Após 18h');
    expect(updated.notes).toBe('Observações atualizadas');

    const removed = await MessageModel.remove(id);
    expect(removed).toBe(true);
    expect(await MessageModel.findById(id)).toBeNull();
  });

  test('list keeps newest first with timestamps', async () => {
    const db = await resetDatabase();
    db.exec(`
      INSERT INTO messages (call_date, call_time, recipient, sender_name, subject, message, status, created_at, updated_at)
      VALUES ('2024-01-01','09:00','Dest1','Rem1','A','Mensagem A','pending','2024-01-01 10:00:00','2024-01-01 10:00:00'),
             ('2024-01-02','10:00','Dest2','Rem2','B','Mensagem B','resolved','2024-01-02 11:00:00','2024-01-02 11:00:00');
    `);

    const list = await MessageModel.list({ limit: 5 });
    const subjects = list.map(item => item.subject);
    expect(subjects).toEqual(['B', 'A']);
    expect(list[0].status).toBe('resolved');
    expect(list[1].status).toBe('pending');
  });

  test('stats aggregates counts per status', async () => {
    const db = await resetDatabase();
    db.exec(`
      INSERT INTO messages (call_date, call_time, recipient, sender_name, subject, message, status, created_at, updated_at)
      VALUES ('2024-01-01','09:00','Dest1','Rem1','A','Mensagem A','pending','2024-01-01 10:00:00','2024-01-01 10:00:00'),
             ('2024-01-02','10:00','Dest2','Rem2','B','Mensagem B','resolved','2024-01-02 11:00:00','2024-01-02 11:00:00');
    `);

    const summary = await MessageModel.stats();

    expect(summary).toEqual({
      total: 2,
      pending: 1,
      in_progress: 0,
      resolved: 1,
    });
  });
});
