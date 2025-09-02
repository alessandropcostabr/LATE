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

beforeEach(() => {
  // Limpa tabela e insere dados de teste
  RecadoModel.db.prepare('DELETE FROM recados').run();
  const samples = [
    {
      data_ligacao: '2024-01-01',
      hora_ligacao: '09:00',
      destinatario: 'Alice',
      remetente_nome: 'Bob',
      assunto: 'Assunto1',
      situacao: 'pendente',
      observacoes: 'Obs1',
    },
    {
      data_ligacao: '2024-01-02',
      hora_ligacao: '10:00',
      destinatario: 'Alice',
      remetente_nome: 'Charlie',
      assunto: 'Assunto2',
      situacao: 'em_andamento',
      observacoes: 'Obs2',
    },
    {
      data_ligacao: '2024-01-03',
      hora_ligacao: '11:00',
      destinatario: 'Dave',
      remetente_nome: 'Bob',
      assunto: 'Assunto3',
      situacao: 'resolvido',
      observacoes: 'Obs3',
    },
    {
      data_ligacao: '2024-02-01',
      hora_ligacao: '12:00',
      destinatario: 'Eve',
      remetente_nome: 'Frank',
      assunto: 'Meeting schedule',
      situacao: 'pendente',
      observacoes: 'Check details',
    },
  ];
  samples.forEach((s) => RecadoModel.create(s));
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

test('findAll and count return same totals without filters', () => {
  const list = RecadoModel.findAll({});
  const total = RecadoModel.count({});
  expect(list.length).toBe(total);
});

test.each([
  [{ destinatario: 'Alice' }],
  [{ situacao: 'pendente' }],
  [{ remetente: 'Bob' }],
  [{ data_inicio: '2024-01-01', data_fim: '2024-01-02' }],
  [{ busca: 'Meeting' }],
])('findAll and count apply identical filters %p', (filters) => {
  const list = RecadoModel.findAll(filters);
  const total = RecadoModel.count(filters);
  expect(list.length).toBe(total);
});

test('count ignores pagination options', () => {
  const filters = { situacao: 'pendente', limit: 1, offset: 0 };
  const list = RecadoModel.findAll(filters);
  expect(list.length).toBe(1);
  const total = RecadoModel.count(filters);
  expect(total).toBe(2);
});

test('findAll defaults to safe ordering when invalid params provided', () => {
  const defaultList = RecadoModel.findAll({});
  const invalidList = RecadoModel.findAll({ orderBy: 'malicious', orderDir: 'INVALID' });
  expect(invalidList).toEqual(defaultList);
});

test('findAll defaults to DESC when orderDir invalid', () => {
  const expected = RecadoModel.findAll({ orderBy: 'id', orderDir: 'DESC' });
  const invalidDir = RecadoModel.findAll({ orderBy: 'id', orderDir: 'bad' });
  expect(invalidDir).toEqual(expected);
});
