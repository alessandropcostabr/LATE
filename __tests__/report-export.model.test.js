process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');

let dbPool;
let ReportExportModel;

function setupDatabase() {
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
  ReportExportModel = require('../models/reportExport');
}

async function createSchema() {
  await dbPool.query(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      role TEXT DEFAULT 'ADMIN',
      is_active BOOLEAN DEFAULT TRUE,
      allow_offsite_access BOOLEAN DEFAULT TRUE,
      access_restrictions JSONB NOT NULL DEFAULT '{}'::jsonb,
      view_scope TEXT DEFAULT 'all',
      session_version INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE report_exports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      export_type TEXT NOT NULL,
      format TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_by INTEGER NOT NULL REFERENCES users(id),
      file_path TEXT,
      file_name TEXT,
      file_size BIGINT,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    INSERT INTO users (id, name, email) VALUES (1, 'Admin', 'admin@late.dev');
  `);
}

describe('ReportExportModel', () => {
  beforeAll(async () => {
    setupDatabase();
    await createSchema();
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  it('cria exportação e lista para o usuário', async () => {
    const job = await ReportExportModel.create({
      exportType: 'event_logs',
      format: 'csv',
      filters: { entityType: 'message' },
      createdBy: 1,
    });

    expect(job.export_type).toBe('event_logs');
    const items = await ReportExportModel.listByUser(1, { limit: 5 });
    expect(items).toHaveLength(1);
    expect(items[0].filters).toEqual({ entityType: 'message' });
  });

  it('remove filtros internos antes de retornar', async () => {
    await ReportExportModel.create({
      exportType: 'messages',
      format: 'json',
      filters: { status: 'pending', _viewer: { id: 1 } },
      createdBy: 1,
    });

    const items = await ReportExportModel.listByUser(1);
    const target = items.find((item) => item.export_type === 'messages');
    expect(target).toBeDefined();
    expect(target.filters).toEqual({ status: 'pending' });
  });

  it('pullPending marca registros como processing', async () => {
    await ReportExportModel.create({
      exportType: 'event_logs',
      format: 'csv',
      filters: {},
      createdBy: 1,
    });

    const jobs = await ReportExportModel.pullPending(5);
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].status).toBe('processing');
  });
});
