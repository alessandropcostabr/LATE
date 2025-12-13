const path = require('path');
const express = require('express');
const supertest = require('supertest');
const { newDb } = require('pg-mem');

const { normalizeRoleSlug, hasPermission } = require('../middleware/auth');

jest.mock('../middleware/csrf', () => jest.fn((_req, _res, next) => next()));

describe('Web · CRM Dashboard', () => {
  let mem;
  let dbManager;

  beforeEach(async () => {
    ({ mem, dbManager } = setupDatabase());
    await bootstrapSchema(mem);
    await seedUser(mem);
  });

  afterEach(async () => {
    if (dbManager?.close) await dbManager.close();
    jest.resetModules();
    delete global.__LATE_POOL_FACTORY;
  });

  test('GET /crm/dashboard renderiza com usuário autenticado', async () => {
    const app = createApp({
      id: 1,
      name: 'Admin Test',
      role: 'ADMIN',
      viewScope: 'all',
    });

    const res = await supertest(app).get('/crm/dashboard');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Dashboard CRM');
    expect(res.text).toContain('Pipeline por mês/estágio');
  });

  function setupDatabase() {
    const memInstance = newDb({ autoCreateForeignKeyIndices: true });
    const adapter = memInstance.adapters.createPg();
    global.__LATE_POOL_FACTORY = () => new adapter.Pool();
    jest.resetModules();
    const db = require('../config/database');
    return { mem: memInstance, dbManager: db };
  }

  async function bootstrapSchema(memInstance) {
    const db = memInstance.public;
    db.registerFunction({
      name: 'trim',
      args: ['text'],
      returns: 'text',
      implementation: (v) => (v === null || v === undefined ? null : String(v).trim()),
    });

    db.none(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'OPERADOR',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        view_scope TEXT NOT NULL DEFAULT 'all',
        access_restrictions JSONB DEFAULT '{}'::jsonb,
        allow_offsite_access BOOLEAN DEFAULT FALSE,
        session_version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  }

  async function seedUser(memInstance) {
    const db = memInstance.public;
    db.none(`
      INSERT INTO users (id, name, email, role, is_active, view_scope, session_version)
      VALUES (1, 'Admin Test', 'admin@test.local', 'ADMIN', TRUE, 'all', 1);
    `);
  }

  function createApp(sessionUser) {
    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '..', 'views'));
    app.locals.cssFile = '/css/style.min.css';
    app.locals.appVersion = 'test';
    app.locals.appBuild = 'test';

    app.use((req, res, next) => {
      req.session = {
        user: { ...sessionUser, sessionVersion: 1 },
        sessionVersion: 1,
        destroy: jest.fn((cb) => cb?.()),
        cookie: {},
      };
      const roleSlug = normalizeRoleSlug(sessionUser.role);
      res.locals.user = sessionUser;
      res.locals.userRoleSlug = roleSlug;
      res.locals.permissions = {
        readMessages: hasPermission(roleSlug, 'read'),
        createMessages: hasPermission(roleSlug, 'create'),
        updateMessages: hasPermission(roleSlug, 'update'),
        deleteMessages: hasPermission(roleSlug, 'delete'),
      };
      res.locals.appVersion = app.locals.appVersion;
      res.locals.appBuild = app.locals.appBuild;
      next();
    });

    const webRoutes = require('../routes/web');
    app.use(webRoutes);
    return app;
  }
});
