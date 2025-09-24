process.env.DB_PATH = '';

const dbManager = require('../config/database');
let MessageModel;

beforeEach(() => {
  dbManager.close();
  const db = dbManager.getDatabase();
  db.exec(`
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
  `);
  delete require.cache[require.resolve('../models/message')];
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

test('list keeps newest first with timestamps', () => {
  const db = dbManager.getDatabase();
  db.exec(`
    INSERT INTO messages (call_date, call_time, recipient, sender_name, subject, message, status, created_at, updated_at)
    VALUES ('2024-01-01','09:00','Dest1','Rem1','A','Mensagem A','pending','2024-01-01 10:00:00','2024-01-01 10:00:00'),
           ('2024-01-02','10:00','Dest2','Rem2','B','Mensagem B','resolved','2024-01-02 11:00:00','2024-01-02 11:00:00');
  `);

  const list = MessageModel.list({ limit: 5 });
  const subjects = list.map(item => item.subject);
  expect(subjects).toEqual(['B', 'A']);
  expect(list[0].status).toBe('resolved');
  expect(list[1].status).toBe('pending');
});
