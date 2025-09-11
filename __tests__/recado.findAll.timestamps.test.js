process.env.DB_PATH = '';

const dbManager = require('../config/database');
let RecadoModel;

beforeEach(() => {
  dbManager.close();
  delete require.cache[require.resolve('../models/recado')];
});

afterAll(() => {
  dbManager.close();
});

test('findAll orders by created_at when column exists', () => {
  const db = dbManager.getDatabase();
  db.exec(`
    CREATE TABLE recados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      created_at DATETIME
    );
    INSERT INTO recados (titulo, created_at) VALUES
      ('Primeiro', '2024-01-01 10:00:00'),
      ('Segundo', '2024-01-02 12:00:00');
  `);
  RecadoModel = require('../models/recado');
  RecadoModel.db = db;
  const list = RecadoModel.findAll({});
  expect(list[0].titulo).toBe('Segundo');
  expect(list[1].titulo).toBe('Primeiro');
});

test('findAll falls back to criado_em when created_at missing', () => {
  const db = dbManager.getDatabase();
  db.exec(`
    CREATE TABLE recados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      criado_em DATETIME
    );
    INSERT INTO recados (titulo, criado_em) VALUES
      ('Recente', '2024-01-02 12:00:00'),
      ('Antigo', '2024-01-01 10:00:00');
  `);
  RecadoModel = require('../models/recado');
  RecadoModel.db = db;
  const list = RecadoModel.findAll({});
  expect(list[0].titulo).toBe('Recente');
  expect(list[1].titulo).toBe('Antigo');
});
