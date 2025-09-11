process.env.DB_PATH = '';

const dbManager = require('../config/database');

beforeEach(() => {
  dbManager.close();
  delete require.cache[require.resolve('../models/user')];
});

afterAll(() => {
  dbManager.close();
});

test('list returns created_at and updated_at when columns exist', () => {
  const UserModel = require('../models/user');
  UserModel.create({
    name: 'Alice',
    email: 'alice@example.com',
    password_hash: 'hash',
    role: 'ADMIN'
  });
  const { data } = UserModel.list({});
  expect(data[0]).toHaveProperty('created_at');
  expect(data[0]).toHaveProperty('updated_at');
  expect(data[0]).not.toHaveProperty('criado_em');
});

test('list aliases criado_em as created_at when created_at missing', () => {
  const UserModel = require('../models/user');
  const db = dbManager.getDatabase();
  // Replace table with legacy schema
  db.exec('DROP TABLE IF EXISTS users');
  db.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OPERADOR' CHECK (role IN ('ADMIN','SUPERVISOR','OPERADOR','LEITOR')),
    is_active INTEGER NOT NULL DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  UserModel.db = db;
  UserModel.create({
    name: 'Bob',
    email: 'bob@example.com',
    password_hash: 'hash',
    role: 'OPERADOR'
  });
  const { data } = UserModel.list({});
  expect(data[0]).toHaveProperty('created_at');
  expect(data[0]).not.toHaveProperty('updated_at');
  expect(data[0]).not.toHaveProperty('criado_em');
});
