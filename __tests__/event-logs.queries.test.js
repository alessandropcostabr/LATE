process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');

describe('Event log analytical queries', () => {
  let dbPool;

  beforeAll(async () => {
    const mem = newDb({ autoCreateForeignKeyIndices: true });
    mem.public.registerFunction({
      name: 'gen_random_uuid',
      returns: 'uuid',
      implementation: () => require('crypto').randomUUID(),
    });

    const adapter = mem.adapters.createPg();
    global.__LATE_POOL_FACTORY = () => new adapter.Pool();
    jest.resetModules();

    dbPool = require('../config/database');
    await dbPool.query(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        access_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb
      );

      INSERT INTO users (id, name)
      VALUES
        (10, 'Agente 10'),
        (11, 'Agente 11'),
        (12, 'Agente 12');

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
      INSERT INTO event_logs (id, event_type, entity_type, entity_id, actor_user_id, metadata, created_at)
      VALUES
        (gen_random_uuid(), 'message.created', 'message', '1', 10, '{}'::jsonb, NOW() - INTERVAL '1 day'),
        (gen_random_uuid(), 'message.created', 'message', '2', 11, '{}'::jsonb, NOW() - INTERVAL '3 day'),
        (gen_random_uuid(), 'message.created', 'message', '3', 11, '{}'::jsonb, NOW() - INTERVAL '40 day'),
        (gen_random_uuid(), 'message.status_changed', 'message', '1', 10, '{"from":"pending","to":"resolved"}'::jsonb, NOW() - INTERVAL '2 day'),
        (gen_random_uuid(), 'message.status_changed', 'message', '2', 10, '{"from":"pending","to":"in_progress"}'::jsonb, NOW() - INTERVAL '10 day'),
        (gen_random_uuid(), 'message.status_changed', 'message', '3', 12, '{"from":"in_progress","to":"resolved"}'::jsonb, NOW() - INTERVAL '1 day'),
        (gen_random_uuid(), 'comment.created', 'message', '1', 10, '{"context":"resolution"}'::jsonb, NOW() - INTERVAL '1 day'),
        (gen_random_uuid(), 'user.login', 'user', '10', 10, '{"interface":"web"}'::jsonb, NOW() - INTERVAL '1 day');
    `);
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  it('executa consultas analíticas planejadas para event_logs', async () => {
    const messagesPerDay = await dbPool.query(`
      SELECT created_at::date AS date, COUNT(*) AS count
        FROM event_logs
       WHERE event_type = 'message.created'
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY created_at::date
       ORDER BY date DESC;
    `);

    const totalCreated = messagesPerDay.rows.reduce(
      (acc, row) => acc + Number(row.count),
      0
    );
    expect(totalCreated).toBe(2);

    const statusChanges = await dbPool.query(`
      SELECT metadata->>'from' AS from_status,
             metadata->>'to'   AS to_status,
             COUNT(*)          AS changes
        FROM event_logs
       WHERE event_type = 'message.status_changed'
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY metadata->>'from', metadata->>'to'
       ORDER BY changes DESC;
    `);

    const statuses = statusChanges.rows.map(
      (row) => `${row.from_status}->${row.to_status}`
    );
    expect(statuses).toEqual(
      expect.arrayContaining(['pending->resolved', 'in_progress->resolved'])
    );
    const totalChanges = statusChanges.rows.reduce(
      (acc, row) => acc + Number(row.changes),
      0
    );
    expect(totalChanges).toBe(2);

    const actionsByUser = await dbPool.query(`
      SELECT u.name, COUNT(*) AS actions
        FROM event_logs el
        JOIN users u ON u.id = el.actor_user_id
       WHERE el.created_at >= NOW() - INTERVAL '7 days'
       GROUP BY u.id, u.name
       ORDER BY actions DESC
       LIMIT 10;
    `);

    expect(actionsByUser.rows.length).toBeGreaterThan(0);
    expect(actionsByUser.rows[0].name).toBe('Agente 10');
    expect(Number(actionsByUser.rows[0].actions)).toBeGreaterThanOrEqual(3);
  });
});
