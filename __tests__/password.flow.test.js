jest.mock('../middleware/csrf', () => jest.fn((req, _res, next) => next()));
jest.mock('../services/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
}));

const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');
const argon2 = require('argon2');

let dbManager;
let app;
let userId;
let userEmail = 'usuario@example.com';

let sendMail;

function setupDatabase() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = mem.adapters.createPg();
  global.__LATE_POOL_FACTORY = () => new adapter.Pool();
  jest.resetModules();
  dbManager = require('../config/database');
}

async function ensureSchema() {
  const db = dbManager.getDatabase();

  await db.exec(`
    DROP TABLE IF EXISTS password_reset_tokens;
    DROP TABLE IF EXISTS users;

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OPERADOR',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      allow_offsite_access BOOLEAN NOT NULL DEFAULT TRUE,
      access_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
      view_scope TEXT NOT NULL DEFAULT 'all',
      session_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function seedUser() {
  const hash = await argon2.hash('SenhaAtual123', { type: argon2.argon2id });
  const result = await dbManager.query(`
    INSERT INTO users (name, email, password_hash, role, is_active, view_scope)
    VALUES ($1, $2, $3, 'ADMIN', TRUE, 'all')
    RETURNING id
  `, ['Usuário Teste', userEmail, hash]);
  userId = result.rows[0].id;
}

beforeAll(async () => {
  setupDatabase();
  await ensureSchema();
  await seedUser();

  ({ sendMail } = require('../services/mailer'));
  const apiRoutes = require('../routes/api');

  app = express();
  app.use(express.json());
  app.use(async (req, _res, next) => {
    try {
      const { rows } = await dbManager.query(
        'SELECT session_version FROM users WHERE id = $1',
        [userId]
      );
      const sessionVersion = Number(rows?.[0]?.session_version) || 1;
      req.session = {
        user: {
          id: userId,
          email: userEmail,
          role: 'ADMIN',
          name: 'Usuário Teste',
          sessionVersion,
        },
        sessionVersion,
        destroy: jest.fn((cb) => cb?.()),
        cookie: {},
      };
      next();
    } catch (err) {
      next(err);
    }
  });
  app.use('/api', apiRoutes);
});

afterAll(async () => {
  await dbManager.close();
  jest.resetModules();
  delete global.__LATE_POOL_FACTORY;
});

beforeEach(async () => {
  await dbManager.query('DELETE FROM password_reset_tokens');
  const baseHash = await argon2.hash('SenhaAtual123', { type: argon2.argon2id });
  await dbManager.query('UPDATE users SET password_hash = $1 WHERE id = $2', [baseHash, userId]);
  jest.clearAllMocks();
});

describe('POST /api/password/recover', () => {
  it('gera token e envia e-mail para usuário existente', async () => {
    const response = await request(app)
      .post('/api/password/recover')
      .send({ email: userEmail });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    const { rows } = await dbManager.query('SELECT * FROM password_reset_tokens WHERE user_id = $1', [userId]);
    expect(rows.length).toBe(1);
    expect(rows[0].used_at).toBeNull();
  });

  it('não revela existência do usuário', async () => {
    const response = await request(app)
      .post('/api/password/recover')
      .send({ email: 'desconhecido@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
    const { rows } = await dbManager.query('SELECT * FROM password_reset_tokens');
    expect(rows.length).toBe(0);
  });
});

describe('POST /api/password/reset', () => {
  it('atualiza a senha com token válido', async () => {
    // Cria token válido via model para obter token em claro
    const PasswordResetTokenModel = require('../models/passwordResetToken');
    const { token } = await PasswordResetTokenModel.createForUser(userId, { ttlMinutes: 60 });

    const response = await request(app)
      .post('/api/password/reset')
      .send({ token, password: 'Guardiao987', confirm: 'Guardiao987' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const userRow = await dbManager.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const hash = userRow.rows[0].password_hash;
    const ok = await argon2.verify(hash, 'Guardiao987');
    expect(ok).toBe(true);

    const tokens = await dbManager.query('SELECT used_at FROM password_reset_tokens WHERE user_id = $1', [userId]);
    expect(tokens.rows[0].used_at).not.toBeNull();
  });

  it('recusa token inválido', async () => {
    const response = await request(app)
      .post('/api/password/reset')
      .send({ token: 'invalido', password: 'Guardiao987', confirm: 'Guardiao987' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});

describe('POST /api/account/password', () => {
  it('valida senha atual incorreta', async () => {
    const response = await request(app)
      .post('/api/account/password')
      .send({
        currentPassword: 'errada',
        newPassword: 'SenhaNova123',
        confirmPassword: 'SenhaNova123',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Senha atual incorreta/);
  });

  it('atualiza senha quando dados são válidos', async () => {
    const response = await request(app)
      .post('/api/account/password')
      .send({
        currentPassword: 'SenhaAtual123',
        newPassword: 'Planeta987',
        confirmPassword: 'Planeta987',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const { rows } = await dbManager.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const hash = rows[0].password_hash;
    const ok = await argon2.verify(hash, 'Planeta987');
    expect(ok).toBe(true);

    const { rows: tokens } = await dbManager.query('SELECT * FROM password_reset_tokens WHERE user_id = $1', [userId]);
    expect(tokens.length).toBe(0);
  });
});
