const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');
let app;
const dbPath = path.join(__dirname, '..', 'data', 'recados.db');

const makePayload = (overrides = {}) => ({
  data_ligacao: '2025-01-01',
  hora_ligacao: '10:00',
  destinatario: 'Destinatario',
  remetente_nome: 'Remetente',
  remetente_telefone: '11999999999',
  remetente_email: 'remetente@example.com',
  horario_retorno: 'Manhã',
  assunto: 'Assunto de teste',
  situacao: 'pendente',
  observacoes: 'Observação de teste',
  ...overrides,
});

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
  test('POST /api/recados creates a new record', async () => {
    const payload = makePayload();
    const res = await request(app).post('/api/recados').send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toMatchObject(payload);
  });

  test('GET /api/recados lists with filters and pagination', async () => {
    await request(app).post('/api/recados').send(makePayload({ situacao: 'pendente' }));
    await request(app).post('/api/recados').send(makePayload({ situacao: 'em_andamento' }));
    await request(app).post('/api/recados').send(makePayload({ situacao: 'pendente', destinatario: 'Outro' }));

    const res = await request(app).get('/api/recados?situacao=pendente&limit=1&offset=0&orderBy=criado_em&orderDir=ASC');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination).toMatchObject({ total: 2, limit: 1, offset: 0, hasMore: true });
  });

  test('GET /api/recados/:id returns recado and 404 if not found', async () => {
    const createRes = await request(app).post('/api/recados').send(makePayload());
    const id = createRes.body.data.id;
    const okRes = await request(app).get(`/api/recados/${id}`);
    expect(okRes.status).toBe(200);
    expect(okRes.body.data.id).toBe(id);
    const notFound = await request(app).get('/api/recados/9999');
    expect(notFound.status).toBe(404);
  });

  test('PUT /api/recados/:id updates recado', async () => {
    const createRes = await request(app).post('/api/recados').send(makePayload());
    const id = createRes.body.data.id;
    const updatedPayload = makePayload({
      data_ligacao: '2025-02-02',
      hora_ligacao: '11:11',
      destinatario: 'Destinatario Atualizado',
      remetente_nome: 'Remetente Atualizado',
      remetente_telefone: '11888888888',
      remetente_email: 'novo@example.com',
      horario_retorno: 'Tarde',
      assunto: 'Atualizado',
      situacao: 'resolvido',
      observacoes: 'Observações atualizadas',
    });
    const updateRes = await request(app)
      .put(`/api/recados/${id}`)
      .send(updatedPayload);
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data).toMatchObject(updatedPayload);
    const fetchRes = await request(app).get(`/api/recados/${id}`);
    expect(fetchRes.body.data).toMatchObject(updatedPayload);
    const notFound = await request(app)
      .put('/api/recados/9999')
      .send(makePayload());
    expect(notFound.status).toBe(404);
  });

  test('PATCH /api/recados/:id/situacao updates status', async () => {
    const createRes = await request(app).post('/api/recados').send(makePayload());
    const id = createRes.body.data.id;
    const patchRes = await request(app)
      .patch(`/api/recados/${id}/situacao`)
      .send({ situacao: 'resolvido' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.situacao).toBe('resolvido');
    const notFound = await request(app)
      .patch('/api/recados/9999/situacao')
      .send({ situacao: 'pendente' });
    expect(notFound.status).toBe(404);
  });

  test('DELETE /api/recados/:id removes recado and handles missing id', async () => {
    const createRes = await request(app).post('/api/recados').send(makePayload());
    const id = createRes.body.data.id;
    const deleteRes = await request(app).delete(`/api/recados/${id}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body).toEqual({ success: true });
    const notFound = await request(app).delete(`/api/recados/${id}`);
    expect(notFound.status).toBe(404);
  });

  test('POST /api/recados returns 400 for invalid payload', async () => {
    const res = await request(app).post('/api/recados').send({ destinatario: '' });
    expect(res.status).toBe(400);
  });

  test('GET /api/stats returns global statistics', async () => {
    await request(app).post('/api/recados').send(makePayload());
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data.total', 1);
  });
});
