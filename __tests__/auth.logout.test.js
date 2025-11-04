process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');

describe('Auth logout auditing', () => {
  let dbPool;
  let authController;

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
      CREATE TABLE event_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        actor_user_id INTEGER,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    authController = require('../controllers/authController');
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  it('destroys the session e registra audit trail do logout', async () => {
    const destroyMock = jest.fn((cb) => cb?.());
    const req = {
      session: {
        user: { id: 10 },
        destroy: destroyMock,
      },
    };
    const res = {
      redirect: jest.fn().mockReturnValue(undefined),
    };

    await authController.logout(req, res);

    expect(destroyMock).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith('/login');

    const { rows } = await dbPool.query(
      'SELECT event_type, entity_type, entity_id, actor_user_id FROM event_logs'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].event_type).toBe('user.logout');
    expect(rows[0].entity_type).toBe('user');
    expect(rows[0].entity_id).toBe('10');
    expect(rows[0].actor_user_id).toBe(10);
  });
});
