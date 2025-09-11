process.env.DB_PATH = '';

const express = require('express');
const request = require('supertest');
const dbManager = require('../config/database');
let app;

beforeAll(() => {
  const db = dbManager.getDatabase();
  // Cria tabela recados sem coluna created_at para simular banco antigo.
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
      situacao VARCHAR(20) DEFAULT 'pendente',
      observacoes TEXT,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      updated_by INTEGER
    );
  `);

  // Carrega rotas e modelo após garantir schema
  const RecadoModel = require('../models/recado');
  // Insere recado para teste
  RecadoModel.create({
    data_ligacao: '2025-01-01',
    hora_ligacao: '09:00',
    destinatario: 'Destinatario',
    remetente_nome: 'Remetente',
    assunto: 'Teste'
  });
  const apiRoutes = require('../routes/api');
  app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
});

afterAll(() => {
  dbManager.close();
});

test('GET /api/recados-recentes funciona sem created_at', async () => {
  const res = await request(app).get('/api/recados-recentes');
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('success', true);
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body.data.length).toBeGreaterThan(0);
});
