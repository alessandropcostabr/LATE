process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');

describe('Dev diagnostics (Sprint 01)', () => {
  let mem;
  let dbPool;
  let collectDevInfo;
  let debugInfoHandlers = [];

  function createDatabase() {
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
    mem.public.registerFunction({
      name: 'current_database',
      returns: 'text',
      implementation: () => 'pg_mem_test',
      schema: 'pg_catalog',
    });

    const adapter = mem.adapters.createPg();
    global.__LATE_POOL_FACTORY = () => new adapter.Pool();
    jest.resetModules();

    ({ collectDevInfo } = require('../utils/devInfo'));
    dbPool = require('../config/database');
    const apiRoutes = require('../routes/api');
    const layer = apiRoutes.stack.find((entry) => entry?.route?.path === '/debug/info');
    debugInfoHandlers = layer ? layer.route.stack.map((stackItem) => stackItem.handle) : [];
  }

  async function bootstrapSchema() {
    await dbPool.query(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        password_hash TEXT,
        role TEXT DEFAULT 'ADMIN',
        is_active BOOLEAN DEFAULT TRUE,
        view_scope TEXT DEFAULT 'all',
        session_version INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE messages (
        id INTEGER PRIMARY KEY,
        recipient TEXT,
        recipient_user_id INTEGER,
        recipient_sector_id INTEGER,
        sender_name TEXT,
        sender_phone TEXT,
        sender_email TEXT,
        subject TEXT,
        message TEXT,
        status TEXT DEFAULT 'pending',
        visibility TEXT DEFAULT 'private',
        callback_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE message_events (
        id SERIAL PRIMARY KEY,
        message_id INTEGER,
        event_type TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE message_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id INTEGER,
        user_id INTEGER,
        body TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE email_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        to_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        body_json JSONB NOT NULL,
        status TEXT NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await dbPool.query(`
      INSERT INTO users (id, name, email, role, is_active)
      VALUES (1, 'Root Admin', 'root@late.dev', 'ADMIN', TRUE);

      INSERT INTO email_queue (id, to_email, subject, body_json, status)
      VALUES
        ('00000000-0000-0000-0000-000000000001', 'teste@late.dev', 'pendente', '{}'::jsonb, 'pending'),
        ('00000000-0000-0000-0000-000000000002', 'enviado@late.dev', 'enviado', '{}'::jsonb, 'sent');
    `);
  }

  beforeAll(async () => {
    createDatabase();
    await bootstrapSchema();
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  async function runDebugInfoRequest(sessionUser = null) {
    const req = {
      method: 'GET',
      originalUrl: '/api/debug/info',
      session: sessionUser ? { user: { ...sessionUser } } : {},
    };

    let resolvePromise;
    let completed = false;

    const res = {
      statusCode: null,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        if (this.statusCode === null) {
          this.statusCode = 200;
        }
        this.payload = body;
        if (!completed) {
          completed = true;
          resolvePromise();
        }
        return this;
      },
    };

    let index = 0;

    await new Promise((resolve, reject) => {
      resolvePromise = resolve;

      const next = (err) => {
        if (err) {
          if (!completed) {
            completed = true;
            reject(err);
          }
          return;
        }

        const handler = debugInfoHandlers[index++];
        if (!handler) {
          if (!completed) {
            completed = true;
            resolve();
          }
          return;
        }

        try {
          const result = handler(req, res, next);
          if (result && typeof result.then === 'function') {
            result.catch((error) => {
              if (!completed) {
                completed = true;
                reject(error);
              }
            });
          }
        } catch (error) {
          if (!completed) {
            completed = true;
            reject(error);
          }
        }
      };

      next();
    });

    return res;
  }

  it('collectDevInfo retorna snapshot consistente', async () => {
    const info = await collectDevInfo();
    expect(info.nodeEnv).toBe('test');
    expect(Array.isArray(info.messageIndexes)).toBe(true);
    expect(typeof info.emailQueuePending).toBe('number');
    expect(typeof info.generatedAt).toBe('string');
    expect(new Date(info.generatedAt).toString()).not.toBe('Invalid Date');
  });

  it('GET /api/debug/info exige autenticação', async () => {
    const res = await runDebugInfoRequest(null);
    expect(res.statusCode).toBe(401);
    expect(res.payload).toMatchObject({ success: false, error: 'Não autenticado' });
  });

  it('GET /api/debug/info retorna diagnóstico quando autenticado', async () => {
    const res = await runDebugInfoRequest({ id: 1, role: 'ADMIN', name: 'Root Admin', sessionVersion: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.payload.success).toBe(true);
    expect(res.payload.data).toMatchObject({
      nodeEnv: 'test',
      emailQueuePending: 1,
    });
    expect(Array.isArray(res.payload.data.messageIndexes)).toBe(true);
  });
});
