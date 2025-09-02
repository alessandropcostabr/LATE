const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
let RecadoModel;

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
  RecadoModel = require('../models/recado');
});

afterAll(() => {
  const dbManager = require('../config/database');
  dbManager.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  try {
    fs.rmdirSync(path.dirname(dbPath));
  } catch (err) {
    // ignore if directory not empty
  }
});

test('getStats returns object with expected keys', () => {
  const stats = RecadoModel.getStats();
  expect(stats).toHaveProperty('total');
  expect(stats).toHaveProperty('pendente');
  expect(stats).toHaveProperty('em_andamento');
  expect(stats).toHaveProperty('resolvido');
});
