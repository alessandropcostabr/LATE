process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');

let eventLogsController;

describe('EventLogsController', () => {
  let mem;
  let dbPool;

  beforeAll(async () => {
    mem = newDb({ autoCreateForeignKeyIndices: true });
    mem.public.registerFunction({
      name: 'gen_random_uuid',
      returns: 'uuid',
      implementation: () => require('crypto').randomUUID(),
    });
    mem.public.registerFunction({
      name: 'date_trunc',
      args: ['text', 'timestamptz'],
      returns: 'timestamptz',
      implementation: (unit, value) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        const precision = String(unit || '').toLowerCase();
        if (precision === 'day') {
          date.setUTCHours(0, 0, 0, 0);
        }
        return date;
      },
    });

    const adapter = mem.adapters.createPg();
    global.__LATE_POOL_FACTORY = () => new adapter.Pool();
    jest.resetModules();
    dbPool = require('../config/database');
    eventLogsController = require('../controllers/eventLogsController');

    await dbPool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        password_hash TEXT,
        role TEXT NOT NULL DEFAULT 'ADMIN',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        allow_offsite_access BOOLEAN NOT NULL DEFAULT TRUE,
        access_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
        view_scope TEXT NOT NULL DEFAULT 'all',
        session_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE event_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        actor_user_id INTEGER REFERENCES users(id),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await dbPool.query(`
      INSERT INTO users (id, name, email, password_hash, role, session_version) VALUES
        (10, 'João Auditor', 'joao@late.dev', 'hash', 'ADMIN', 1),
        (11, 'Maria Operadora', 'maria@late.dev', 'hash', 'OPERADOR', 1);

      INSERT INTO event_logs (id, event_type, entity_type, entity_id, actor_user_id, metadata, created_at) VALUES
        ('00000000-0000-0000-0000-000000000011', 'message.created', 'message', '100', 10, '{"note":"create"}', NOW() - INTERVAL '2 days'),
        ('00000000-0000-0000-0000-000000000012', 'message.status_changed', 'message', '100', 10, '{"from":"pending","to":"resolved"}', NOW() - INTERVAL '1 day'),
        ('00000000-0000-0000-0000-000000000013', 'automation.fired', 'automation', 'scheduler-1', NULL, '{"status":"processed"}', NOW() - INTERVAL '2 hours');
    `);
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  function fakeRequireAuth(sessionUser) {
    return (req, res, next) => {
      if (!sessionUser) {
        return res.status(401).json({ success: false, error: 'Não autenticado' });
      }
      req.session = {
        user: sessionUser,
      };
      next();
    };
  }

  function fakeRequireRole(allowedRoles = []) {
    return (req, res, next) => {
      const role = String(req.session?.user?.role || '').toUpperCase();
      if (!allowedRoles.map((r) => r.toUpperCase()).includes(role)) {
        return res.status(403).json({ success: false, error: 'Você não tem permissão para acessar este recurso.' });
      }
      next();
    };
  }

  function createApp(sessionUser) {
    const app = express();
    app.use(express.json());
    // injeta req.csrfToken opcional para evitar dependência do middleware real
    app.use((req, _res, next) => { req.csrfToken = () => 'test-csrf'; next(); });
    app.get(
      '/api/event-logs',
      fakeRequireAuth(sessionUser),
      fakeRequireRole(['ADMIN', 'SUPERVISOR']),
      eventLogsController.list,
    );

    app.get(
      '/api/event-logs/summary',
      fakeRequireAuth(sessionUser),
      fakeRequireRole(['ADMIN', 'SUPERVISOR']),
      eventLogsController.summary,
    );

    app.get(
      '/api/event-logs/:id',
      fakeRequireAuth(sessionUser),
      fakeRequireRole(['ADMIN', 'SUPERVISOR']),
      eventLogsController.getById,
    );

    return app;
  }

  test('retorna lista padrão com período de 7 dias', async () => {
    const app = createApp({ id: 10, name: 'João Auditor', role: 'ADMIN', sessionVersion: 1 });
    const response = await request(app).get('/api/event-logs');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.items)).toBe(true);
  });

  test('aplica filtro por event_type', async () => {
    const app = createApp({ id: 10, name: 'João Auditor', role: 'ADMIN', sessionVersion: 1 });
    const response = await request(app).get('/api/event-logs').query({ event_type: 'automation.fired' });
    expect(response.status).toBe(200);
    const items = response.body.data.items;
    expect(items.every((item) => item.event_type === 'automation.fired')).toBe(true);
  });

  test('summary agrega por tipo', async () => {
    const app = createApp({ id: 10, name: 'João Auditor', role: 'ADMIN', sessionVersion: 1 });
    const response = await request(app).get('/api/event-logs/summary');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.byType)).toBe(true);
  });

  test('nega acesso para perfis sem permissão', async () => {
    const app = createApp({ id: 11, name: 'Maria Operadora', role: 'OPERADOR', sessionVersion: 1 });
    const response = await request(app).get('/api/event-logs');
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test('retorna 400 para parâmetros inválidos', async () => {
    const app = createApp({ id: 10, name: 'João Auditor', role: 'ADMIN', sessionVersion: 1 });
    const response = await request(app).get('/api/event-logs').query({ limit: 9999 });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
