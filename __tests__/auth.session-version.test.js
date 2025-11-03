process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');
const argon2 = require('argon2');

describe('Session version enforcement', () => {
  let mem;
  let dbPool;
  let userModel;
  let requireAuth;
  let authController;

  beforeAll(async () => {
    mem = newDb({ autoCreateForeignKeyIndices: true });
    mem.public.registerFunction({
      name: 'current_database',
      returns: 'text',
      implementation: () => 'pg_mem_session',
    });

    const adapter = mem.adapters.createPg();
    global.__LATE_POOL_FACTORY = () => new adapter.Pool();
    jest.resetModules();

    dbPool = require('../config/database');

    await dbPool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        view_scope TEXT NOT NULL DEFAULT 'all',
        session_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const defaultHash = await argon2.hash('SenhaForte!1', { type: argon2.argon2id });
    await dbPool.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, view_scope)
       VALUES (1, 'Admin', 'admin@example.com', $1, 'ADMIN', TRUE, 'all');`,
      [defaultHash]
    );

    userModel = require('../models/user');
    ({ requireAuth } = require('../middleware/auth'));
    authController = require('../controllers/authController');
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  function buildReqRes(sessionOverrides = {}) {
    const req = {
      session: {
        user: {
          id: 1,
          name: 'Admin',
          email: 'admin@example.com',
          role: 'ADMIN',
          viewScope: 'all',
          ...sessionOverrides.user,
        },
        sessionVersion: sessionOverrides.sessionVersion,
        destroy: jest.fn((cb) => {
          if (typeof cb === 'function') cb();
        }),
        cookie: {},
      },
      originalUrl: '/api/secure',
    };

    const res = {
      clearCookie: jest.fn(),
      status: jest.fn(function status(code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(function json(payload) {
        this.payload = payload;
        return this;
      }),
      redirect: jest.fn().mockReturnValue(undefined),
    };

    const next = jest.fn();

    return { req, res, next };
  }

  it('permite a sessão atual e sincroniza a versão', async () => {
    const { req, res, next } = buildReqRes();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.session.sessionVersion).toBe(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('invalida sessão quando session_version diverge', async () => {
    await userModel.bumpSessionVersion(1);

    const { req, res, next } = buildReqRes({ sessionVersion: 1 });

    await requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(req.session.destroy).toHaveBeenCalledTimes(1);
    expect(res.clearCookie).toHaveBeenCalledWith('late.dev.sess');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Sessão expirada. Faça login novamente.' });
  });

  it('incrementa session_version ao efetuar login', async () => {
    const req = {
      body: { email: 'admin@example.com', password: 'SenhaForte!1' },
      headers: { accept: 'text/html' },
      csrfToken: () => 'test-token',
      session: {},
    };

    const sessionStore = {
      save: jest.fn((cb) => { if (typeof cb === 'function') cb(); }),
      destroy: jest.fn((cb) => { if (typeof cb === 'function') cb(); }),
    };

    req.session.regenerate = (cb) => {
      req.session = {
        save: sessionStore.save,
        destroy: sessionStore.destroy,
        cookie: {},
      };
      cb();
    };
    req.session.save = sessionStore.save;
    req.session.destroy = sessionStore.destroy;
    req.session.cookie = {};

    const res = {
      render: jest.fn(),
      redirect: jest.fn(() => res),
      status: jest.fn(function status(code) { this.statusCode = code; return this; }),
      json: jest.fn(function json(payload) { this.payload = payload; return this; }),
    };

    await authController.login(req, res);

    const userAfterLogin = await userModel.findById(1);
    expect(res.redirect).toHaveBeenCalledWith('/');
    expect(req.session.sessionVersion).toBe(userAfterLogin.session_version);
    expect(userAfterLogin.session_version).toBeGreaterThan(1);
  });
});
