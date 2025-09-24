const request = require('supertest');
const express = require('express');
const dbManager = require('../config/database');

let app;

beforeAll(() => {
  const db = dbManager.getDatabase();
  db.prepare(
    `CREATE TABLE recados (
      id INTEGER PRIMARY KEY,
      data_ligacao TEXT,
      hora_ligacao TEXT,
      destinatario TEXT,
      remetente_nome TEXT,
      remetente_telefone TEXT,
      remetente_email TEXT,
      assunto TEXT,
      mensagem TEXT,
      situacao TEXT,
      horario_retorno TEXT,
      observacoes TEXT,
      criado_em DATETIME,
      atualizado_em DATETIME
    )`
  ).run();

  const insert = db.prepare(`
    INSERT INTO recados (
      data_ligacao, hora_ligacao, destinatario, remetente_nome,
      remetente_telefone, remetente_email, assunto, mensagem,
      situacao, horario_retorno, observacoes, criado_em, atualizado_em
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  insert.run('2025-01-01', '09:00', 'Equipe A', 'João', null, null, 'Aviso', 'Mensagem 1', 'pendente', null, null);
  insert.run('2025-01-02', '10:30', 'Equipe B', 'Maria', null, null, 'Aviso', 'Mensagem 2', 'resolvido', null, null);

  const apiRoutes = require('../routes/api');
  app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
});

afterAll(() => {
  dbManager.close();
});

test('orders messages by id descending', async () => {
  const res = await request(app).get('/api/messages');
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  const ids = res.body.data.map(m => m.id);
  expect(ids).toEqual([2, 1]);
});
