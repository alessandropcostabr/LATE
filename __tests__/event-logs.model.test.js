process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');

describe('EventLogModel', () => {
  let mem;
  let dbPool;
  let EventLogModel;

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

    await dbPool.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
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
      INSERT INTO users (id, name) VALUES
        (10, 'João Auditor'),
        (11, 'Maria Supervisor');

      INSERT INTO event_logs (id, event_type, entity_type, entity_id, actor_user_id, metadata, created_at) VALUES
        ('00000000-0000-0000-0000-000000000001', 'message.created', 'message', '1', 10, '{"note":"novo"}', NOW() - INTERVAL '1 day'),
        ('00000000-0000-0000-0000-000000000002', 'message.status_changed', 'message', '1', 10, '{"from":"pending","to":"resolved"}', NOW() - INTERVAL '12 hours'),
        ('00000000-0000-0000-0000-000000000003', 'comment.created', 'message', '1', 11, '{"length":42}', NOW() - INTERVAL '6 hours'),
        ('00000000-0000-0000-0000-000000000004', 'automation.fired', 'automation', 'auto-1', NULL, '{"status":"processed"}', NOW() - INTERVAL '4 hours'),
        ('00000000-0000-0000-0000-000000000005', 'user.login', 'user', '10', 10, '{"interface":"web"}', NOW() - INTERVAL '2 hours');
    `);

    EventLogModel = require('../models/eventLog');
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  test('lista eventos ordenados e respeita limite', async () => {
    const result = await EventLogModel.listFiltered({
      from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      to: new Date(),
      limit: 3,
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].created_at >= result.items[1].created_at).toBe(true);
    expect(result.nextCursor).toBeTruthy();
  });

  test('filtro por prefixo de event_type', async () => {
    const result = await EventLogModel.listFiltered({
      from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      to: new Date(),
      eventTypes: ['message.*'],
      limit: 50,
    });

    const types = result.items.map((item) => item.event_type);
    expect(types.every((type) => type.startsWith('message.'))).toBe(true);
  });

  test('busca em metadata', async () => {
    const result = await EventLogModel.listFiltered({
      from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      to: new Date(),
      search: 'processed',
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].event_type).toBe('automation.fired');
  });

  test('paginacao com cursor', async () => {
    const firstPage = await EventLogModel.listFiltered({
      from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      to: new Date(),
      limit: 2,
    });

    expect(firstPage.nextCursor).toBeTruthy();

    const decoded = Buffer.from(firstPage.nextCursor, 'base64').toString('utf8').split('|');
    const secondPage = await EventLogModel.listFiltered({
      from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      to: new Date(),
      limit: 2,
      cursor: {
        createdAt: new Date(decoded[0]),
        id: decoded[1],
      },
    });

    const idsFirst = firstPage.items.map((item) => item.id);
    const idsSecond = secondPage.items.map((item) => item.id);
    expect(idsFirst.every((id) => !idsSecond.includes(id))).toBe(true);
  });

  test('summary retorna agregados por tipo e diário', async () => {
    const result = await EventLogModel.summary({
      from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      to: new Date(),
    });

    expect(Array.isArray(result.byType)).toBe(true);
    expect(Array.isArray(result.daily)).toBe(true);
    expect(result.byType.length).toBeGreaterThan(0);
    expect(result.daily.length).toBeGreaterThan(0);
  });
});
