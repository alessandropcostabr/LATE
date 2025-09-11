process.env.DB_PATH = '';

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const dbManager = require('../config/database');
let db;
let app;

beforeAll(() => {
  db = dbManager.getDatabase();
  db.exec(`
    CREATE TABLE recados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descricao TEXT,
      user_id INTEGER NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME,
      updated_at DATETIME,
      created_by INTEGER,
      updated_by INTEGER
    );
    INSERT INTO recados (titulo, descricao, user_id, criado_em) VALUES
      ('Primeiro', 'Primeiro recado', 1, '2024-01-01 10:00:00'),
      ('Segundo', 'Segundo recado', 1, '2024-01-02 12:00:00');
  `);

  const migrationSql = fs.readFileSync(
    path.join(__dirname, '..', 'data', 'migrations', '08_recados_add_created_at.sql'),
    'utf8'
  );
  db.exec(migrationSql);

  const apiRoutes = require('../routes/api');
  app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
});

afterAll(() => {
  dbManager.close();
});

test('migration adds created_at and migrates data', () => {
  const columns = db.prepare('PRAGMA table_info(recados)').all();
  const colNames = columns.map((c) => c.name);
  expect(colNames).toContain('created_at');
  expect(colNames).not.toContain('criado_em');
  const rows = db.prepare('SELECT titulo, created_at FROM recados ORDER BY id').all();
  expect(rows[0].created_at).toBe('2024-01-01 10:00:00');
  expect(rows[1].created_at).toBe('2024-01-02 12:00:00');
});

test('GET /api/recados-recentes orders by created_at desc after migration', async () => {
  const res = await request(app).get('/api/recados-recentes?limit=2');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('success', true);
  expect(res.body.data).toHaveLength(2);
  expect(res.body.data[0].titulo).toBe('Segundo');
  expect(res.body.data[1].titulo).toBe('Primeiro');
});
