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

test('create stores and returns a new recado with default status', () => {
  const sample = {
    data_ligacao: '2024-03-01',
    hora_ligacao: '13:00',
    destinatario: 'Grace',
    remetente_nome: 'Heidi',
    assunto: 'Follow up'
  };
  const created = RecadoModel.create(sample);
  expect(created).toMatchObject({
    ...sample,
    situacao: 'pendente'
  });
  expect(created).toHaveProperty('id');
  expect(RecadoModel.count({})).toBe(5);
});

test('findAll supports pagination with limit and offset', () => {
  const full = RecadoModel.findAll({ orderBy: 'id', orderDir: 'ASC' });
  const paged = RecadoModel.findAll({ orderBy: 'id', orderDir: 'ASC', limit: 2, offset: 1 });
  expect(paged).toEqual(full.slice(1, 3));
});

test('update modifies all fields of a recado', () => {
  const original = RecadoModel.findAll({ orderBy: 'id', orderDir: 'ASC' })[0];
  const updated = RecadoModel.update(original.id, {
    ...original,
    assunto: 'Updated assunto',
    situacao: 'em_andamento'
  });
  expect(updated.assunto).toBe('Updated assunto');
  expect(updated.situacao).toBe('em_andamento');
});

test('updateSituacao changes only the status field', () => {
  const recado = RecadoModel.findAll({ orderBy: 'id', orderDir: 'ASC' })[0];
  const ok = RecadoModel.updateSituacao(recado.id, 'resolvido');
  expect(ok).toBe(true);
  const fetched = RecadoModel.findById(recado.id);
  expect(fetched.situacao).toBe('resolvido');
});

test('delete removes recado and returns true', () => {
  const recado = RecadoModel.findAll({ orderBy: 'id', orderDir: 'ASC' })[0];
  const ok = RecadoModel.delete(recado.id);
  expect(ok).toBe(true);
  expect(RecadoModel.findById(recado.id)).toBeUndefined();
  expect(RecadoModel.count({})).toBe(3);
});

test('count with filter returns number of matching records', () => {
  expect(RecadoModel.count({ situacao: 'pendente' })).toBe(2);
});

test('methods throw error when database instance missing', () => {
  const originalDb = RecadoModel.db;
  RecadoModel.db = null;
  expect(() => RecadoModel.findAll({})).toThrow('Database connection is not initialized');
  RecadoModel.db = originalDb;
});

test('methods throw error when database connection is closed', () => {
  const dbManager = require('../config/database');
  dbManager.close();
  expect(() => RecadoModel.findAll({})).toThrow('Database connection is not initialized');
  RecadoModel.db = dbManager.getDatabase();
});
