process.env.NODE_ENV = 'test';

const { newDb } = require('pg-mem');

jest.mock('../controllers/helpers/viewer', () => ({
  resolveViewerWithSectors: jest.fn(async (req) => ({
    id: req.session?.user?.id || 1,
    viewScope: 'all',
    sectorIds: [],
  })),
}));

let dbPool;
let reportExportController;

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
  reportExportController = require('../controllers/reportExportController');
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

function buildRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

describe('ReportExportController', () => {
  beforeAll(async () => {
    setupDatabase();
    await createSchema();
  });

  afterAll(async () => {
    await dbPool.close?.();
    delete global.__LATE_POOL_FACTORY;
  });

  it('agenda exportação de auditoria com sucesso', async () => {
    const req = {
      body: {
        from: '2025-11-01T00:00:00.000Z',
        to: '2025-11-02T00:00:00.000Z',
        format: 'csv',
      },
      session: { user: { id: 1 } },
    };
    const res = buildRes();

    await reportExportController.requestEventLogsExport(req, res);
    expect(res.statusCode).toBe(202);
    expect(res.payload?.success).toBe(true);
  });

  it('retorna erro para filtros inválidos', async () => {
    const req = {
      body: {
        from: '2025-11-05T00:00:00.000Z',
        to: '2025-11-01T00:00:00.000Z',
      },
      session: { user: { id: 1 } },
    };
    const res = buildRes();

    await reportExportController.requestEventLogsExport(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('agenda exportação de registros e lista histórico', async () => {
    const req = {
      body: {
        status: 'pending',
        format: 'json',
      },
      session: { user: { id: 1 } },
    };
    const res = buildRes();

    await reportExportController.requestMessagesExport(req, res);
    expect(res.statusCode).toBe(202);

    const listReq = { session: { user: { id: 1 } }, query: {} };
    const listRes = buildRes();
    await reportExportController.list(listReq, listRes);

    expect(listRes.statusCode).toBe(200);
    expect(Array.isArray(listRes.payload?.data)).toBe(true);
    const [first] = listRes.payload.data;
    if (first) {
      expect(first.filters._viewer).toBeUndefined();
    }
  });
});
