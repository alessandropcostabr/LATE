const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');
let app;
const dbPath = path.join(__dirname, '..', 'data', 'recados.db');

beforeAll(() => {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  let schema = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', 'schema_20250718.sql'),
    'utf8'
  );
  schema = schema.replace(/CREATE TABLE sqlite_sequence\(name,seq\);/i, '');
  db.exec(schema);
  db.close();
  const apiRoutes = require('../routes/api');
  app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
});

afterEach(() => {
  const db = require('../config/database').getDatabase();
  db.exec('DELETE FROM recados');
});

afterAll(() => {
  const dbManager = require('../config/database');
  dbManager.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  try {
    fs.rmdirSync(path.dirname(dbPath));
  } catch (err) {
    // ignore
  }
});

describe('API endpoints', () => {
  test('GET /api/stats returns stats object', async () => {
    const payload = {
      data_ligacao: '2025-01-01',
      hora_ligacao: '10:00',
      destinatario: 'Destinatario',
      remetente_nome: 'Remetente',
      assunto: 'Assunto de teste'
    };
    const createRes = await request(app).post('/api/recados').send(payload);
    expect(createRes.status).toBe(201);
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toMatchObject({
      total: 1,
      pendente: 1,
      em_andamento: 0,
      resolvido: 0
    });
  });

  test('DELETE /api/recados/:id removes recado', async () => {
    const payload = {
      data_ligacao: '2025-01-01',
      hora_ligacao: '10:00',
      destinatario: 'Destinatario',
      remetente_nome: 'Remetente',
      assunto: 'Teste assunto'
    };
    const createRes = await request(app).post('/api/recados').send(payload);
    expect(createRes.status).toBe(201);
    const id = createRes.body.data.id;

    const deleteRes = await request(app).delete(`/api/recados/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ success: true });
  });
});
