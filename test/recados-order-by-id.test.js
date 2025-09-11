const request = require('supertest');
const express = require('express');
const dbManager = require('../config/database');

let app;

beforeAll(() => {
  const db = dbManager.getDatabase();
  db.prepare(
    `CREATE TABLE recados (
      id INTEGER PRIMARY KEY,
      destinatario TEXT
    )`
  ).run();
  db.prepare('INSERT INTO recados (destinatario) VALUES (?)').run('A');
  db.prepare('INSERT INTO recados (destinatario) VALUES (?)').run('B');

  const apiRoutes = require('../routes/api');
  app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
});

afterAll(() => {
  dbManager.close();
});

test('orders by id when timestamp columns are absent', async () => {
  const res = await request(app).get('/api/recados?orderBy=created_at');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const ids = res.body.data.map(r => r.id);
  expect(ids).toEqual([2, 1]);
});
