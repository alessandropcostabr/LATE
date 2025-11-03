process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');
const { newDb } = require('pg-mem');

describe('Dev diagnostics (Sprint 01)', () => {
  let mem;
  let dbPool;
  let collectDevInfo;

  function buildApp(sessionUser = null) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = sessionUser ? { user: { ...sessionUser } } : {};
      next();
    });
    const apiRoutes = require('../routes/api');
    app.use('/api', apiRoutes);
    return app;
  }

  beforeAll(async () => {
    mem = newDb({ autoCreateForeignKeyIndices: true });
    mem.public.registerFunction({
      name: 'gen_random_uuid',
      returns: 'uuid',
      implementation: () => require('crypto').randomUUID(),
    });
    mem.public.registerFunction({
      name: 'current_database',
      returns: 'text',
      implementation: () => 'pg_mem_test',
    });

    const adapter = mem.adapters.createPg();
    global.__LATE_POOL_FACTORY = () => new adapter.Pool();
    jest.resetModules();

    ({ collectDevInfo } = require('../utils/devInfo'));
    dbPool = require('../config/database');

    await dbPool.query(`
      CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        callback_at TIMESTAMPTZ
      )
    `);
    await dbPool.query('CREATE INDEX idx_messages_status_cb_at ON messages(status, callback_at DESC)');
    await dbPool.query('CREATE INDEX idx_messages_created_at ON messages(created_at DESC)');
    await dbPool.query(`
      CREATE TABLE email_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await dbPool.query(
      `INSERT INTO email_queue (id, to_email, subject, body_json, status)
       VALUES
        ($1, 'teste@late.dev', 'pendente', '{}'::jsonb, 'pending'),
        ($2, 'enviado@late.dev', 'enviado', '{}'::jsonb, 'sent')`,
      [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
      ]
    );
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  it('collectDevInfo retorna snapshot consistente', async () => {
    const info = await collectDevInfo();
    expect(info.nodeEnv).toBe('test');
    expect(Array.isArray(info.messageIndexes)).toBe(true);
    expect(info.emailQueuePending).toBe(1);
    expect(typeof info.pgcrypto === 'boolean' || info.pgcrypto === null).toBe(true);
    expect(typeof info.generatedAt).toBe('string');
    expect(new Date(info.generatedAt).toString()).not.toBe('Invalid Date');
  });

  it('GET /api/debug/info exige autenticação', async () => {
    const app = buildApp(null);
    const response = await request(app).get('/api/debug/info');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: 'Não autenticado' });
  });

  it('GET /api/debug/info retorna diagnóstico quando autenticado', async () => {
    const app = buildApp({ id: 1, role: 'ADMIN', name: 'Root Admin' });
    const response = await request(app).get('/api/debug/info');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      nodeEnv: 'test',
      emailQueuePending: 1,
    });
    expect(Array.isArray(response.body.data.messageIndexes)).toBe(true);
  });
});
