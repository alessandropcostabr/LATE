process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');

function setupDatabase() {
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  mem.public.registerFunction({ name: 'gen_random_uuid', returns: 'uuid', implementation: () => require('crypto').randomUUID() });
  mem.public.registerFunction({
    name: 'date_trunc',
    args: ['text', 'timestamptz'],
    returns: 'timestamptz',
    implementation: (unit, value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      const precision = String(unit || '').toLowerCase();
      if (precision === 'minute') {
        date.setSeconds(0, 0);
      }
      return date;
    },
  });
  const adapter = mem.adapters.createPg();
  global.__LATE_POOL_FACTORY = () => new adapter.Pool();
  jest.resetModules();
  const dbManager = require('../config/database');
  return { mem, dbManager };
}

describe('AutomationLogModel', () => {
  let dbManager;
  let AutomationLogModel;

  beforeEach(async () => {
    ({ dbManager } = setupDatabase());
    const db = dbManager.getDatabase();
    await db.exec(`
      CREATE TABLE automations (
        id UUID PRIMARY KEY,
        event TEXT NOT NULL
      );

      CREATE TABLE automation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        automation_id UUID NOT NULL,
        message_id INTEGER,
        status TEXT NOT NULL,
        error TEXT,
        payload JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at_minute TIMESTAMPTZ NOT NULL DEFAULT date_trunc('minute', NOW())
      );

      CREATE UNIQUE INDEX uniq_automation_logs_minute
        ON automation_logs (automation_id, COALESCE(message_id, -1), created_at_minute);
    `);

    AutomationLogModel = require('../models/automationLog');
  });

  afterEach(async () => {
    await dbManager.close();
    jest.resetModules();
    delete global.__LATE_POOL_FACTORY;
  });

  test('ignora duplicidades no mesmo minuto', async () => {
    const automationId = '11111111-1111-4111-8111-111111111111';
    const createdAt = new Date('2025-01-01T10:00:00Z');

    const first = await AutomationLogModel.create({
      automationId,
      messageId: 42,
      status: 'processed',
      error: null,
      payload: { attempt: 1 },
      createdAt,
    });

    expect(first).toBeTruthy();

    const duplicate = await AutomationLogModel.create({
      automationId,
      messageId: 42,
      status: 'processed',
      error: null,
      payload: { attempt: 2 },
      createdAt,
    });

    expect(duplicate).toBeNull();

    const { rows } = await dbManager.getDatabase().query('SELECT COUNT(*) AS total FROM automation_logs');
    expect(Number(rows[0].total)).toBe(1);
  });
});
