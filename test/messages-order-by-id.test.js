const request = require('supertest');
const express = require('express');
const dbManager = require('../config/database');

let app;

beforeAll(async () => {
  const db = dbManager.getDatabase();
  try {
    await db.prepare(
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        call_date TEXT,
        call_time TEXT,
        recipient TEXT,
        sender_name TEXT,
        sender_phone TEXT,
        sender_email TEXT,
        subject TEXT,
        message TEXT,
        status TEXT,
        callback_time TEXT,
        notes TEXT,
        created_at DATETIME,
        updated_at DATETIME
      )`
    ).run();
  } catch (err) {
    console.error('Failed to create messages table for tests:', err);
    throw err;
  }

  const valuePlaceholders = Array.from({ length: 11 }, (_, index) => dbManager.placeholder(index + 1)).join(', ');
  const insert = db.prepare(`
    INSERT INTO messages (
      call_date, call_time, recipient, sender_name,
      sender_phone, sender_email, subject, message,
      status, callback_time, notes, created_at, updated_at
    ) VALUES (${valuePlaceholders}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING id
  `);

  try {
    await insert.get(['2025-01-01', '09:00', 'Equipe A', 'João', null, null, 'Aviso', 'Mensagem 1', 'pending', null, null]);
    await insert.get(['2025-01-02', '10:30', 'Equipe B', 'Maria', null, null, 'Aviso', 'Mensagem 2', 'resolved', null, null]);
  } catch (err) {
    console.error('Failed to seed messages table for tests:', err);
    throw err;
  }

  const apiRoutes = require('../routes/api');
  app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
});

afterAll(async () => {
  await dbManager.close();
});

test('orders messages by id descending', async () => {
  const res = await request(app).get('/api/messages');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const ids = res.body.data.map(m => m.id);
  expect(ids).toEqual([2, 1]);
});
