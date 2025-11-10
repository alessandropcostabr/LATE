const express = require('express');
const supertest = require('supertest');

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../models/reportExport', () => ({
  getQueueMetrics: jest.fn(),
}));

const statusController = require('../controllers/statusController');
const databaseMock = require('../config/database');
const reportExportModel = require('../models/reportExport');

function createJsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name) => (name && name.toLowerCase() === 'content-type' ? 'application/json' : ''),
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

describe('GET /api/status', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.get('/api/status', statusController.getStatus);
    databaseMock.query.mockReset();
    reportExportModel.getQueueMetrics.mockReset().mockResolvedValue({
      counts: { pending: 0, processing: 0, failed: 0 },
      stalled: 0,
      last_failed: null,
      last_completed_at: null,
    });
    global.fetch = jest.fn();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('retorna informações completas incluindo dados do Prometheus quando configurado', async () => {
    process.env.VIP_HEALTH_URL = 'http://vip.local/health';
    process.env.TUNNEL_HEALTH_URL = 'http://tunnel.local/health';
    process.env.PROMETHEUS_URL = 'http://prometheus.local:9090';
    process.env.npm_package_version = '2.0.0-test';
    process.env.APP_BUILD = 'build-xyz';

    databaseMock.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('SELECT 1 as ok')) {
        return { rows: [{ ok: 1 }] };
      }
      if (text.includes('pg_is_in_recovery')) {
        return { rows: [{ is_recovery: false }] };
      }
      if (text.includes('FROM pg_stat_replication')) {
        return {
          rows: [
            {
              application_name: 'replica-a',
              client_addr: '10.0.0.2',
              state: 'streaming',
              sync_state: 'sync',
            },
            {
              application_name: 'replica-b',
              client_addr: '10.0.0.3',
              state: 'streaming',
              sync_state: 'async',
            },
          ],
        };
      }
      throw new Error(`Consulta inesperada: ${text}`);
    });

    global.fetch
      .mockResolvedValueOnce(createJsonResponse({ status: 'ok' })) // VIP
      .mockResolvedValueOnce(createJsonResponse({ status: 'ok' })) // Tunnel
      .mockResolvedValueOnce(createJsonResponse({ status: 'success', data: { result: [{ metric: { instance: 'node-a:9100' }, value: [0, '1'] }, { metric: { instance: 'node-b:9100' }, value: [0, '0'] }] } })) // up
      .mockResolvedValueOnce(createJsonResponse({ status: 'success', data: { result: [{ metric: { instance: 'node-a:9100' }, value: [0, '0.35'] }, { metric: { instance: 'node-b:9100' }, value: [0, '0.60'] }] } })) // load1
      .mockResolvedValueOnce(createJsonResponse({ status: 'success', data: { result: [{ metric: { instance: 'node-a:9100' }, value: [0, '23.2'] }, { metric: { instance: 'node-b:9100' }, value: [0, '78.9'] }] } })) // cpu
      .mockResolvedValueOnce(createJsonResponse({ status: 'success', data: { result: [{ metric: { instance: 'node-a:9100' }, value: [0, '40'] }, { metric: { instance: 'node-b:9100' }, value: [0, '55'] }] } })) // mem
      .mockResolvedValueOnce(createJsonResponse({ status: 'success', data: { result: [{ metric: { instance: 'node-a:9100' }, value: [0, '12'] }, { metric: { instance: 'node-b:9100' }, value: [0, '20'] }] } })) // rootfs
      .mockResolvedValueOnce(createJsonResponse({ status: 'success', data: { result: [{ metric: { instance: 'node-a:9100' }, value: [0, '12000'] }, { metric: { instance: 'node-b:9100' }, value: [0, '15000'] }] } })) // rx
      .mockResolvedValueOnce(createJsonResponse({ status: 'success', data: { result: [{ metric: { instance: 'node-a:9100' }, value: [0, '9000'] }, { metric: { instance: 'node-b:9100' }, value: [0, '11000'] }] } })); // tx

    reportExportModel.getQueueMetrics.mockResolvedValue({
      counts: { pending: 2, processing: 1, failed: 3 },
      stalled: 1,
      last_failed: { id: 'fail-1', error: 'timeout', at: '2025-11-08T10:00:00.000Z' },
      last_completed_at: '2025-11-08T11:00:00.000Z',
    });

    const response = await supertest(app).get('/api/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const { app: appData, db, vip_health: vip, tunnel_health: tunnel, prometheus, exports: exportsQueue } = response.body.data;

    expect(appData.version).toBe('2.0.0-test');
    expect(appData.build).toBe('build-xyz');
    expect(db.ok).toBe(true);
    expect(db.replication.role).toBe('primary');
    expect(Array.isArray(db.replication.peers)).toBe(true);
    expect(vip).toEqual({ available: true, status: 200, data: { status: 'ok' } });
    expect(tunnel).toEqual({ available: true, status: 200, data: { status: 'ok' } });
    expect(prometheus.enabled).toBe(true);
    expect(prometheus.nodes['node-a:9100']).toMatchObject({
      up: 1,
      load1: 0.35,
      cpu: 23.2,
      mem: 40,
      rootfs: 12,
      rx: 12000,
      tx: 9000,
    });
    expect(prometheus.nodes['node-b:9100']).toMatchObject({
      up: 0,
      load1: 0.6,
      cpu: 78.9,
      mem: 55,
      rootfs: 20,
      rx: 15000,
      tx: 11000,
    });
    expect(global.fetch).toHaveBeenCalledTimes(9);
    expect(exportsQueue).toMatchObject({
      counts: { pending: 2, processing: 1, failed: 3 },
      stalled: 1,
      last_failed: { id: 'fail-1', error: 'timeout', at: '2025-11-08T10:00:00.000Z' },
      last_completed_at: '2025-11-08T11:00:00.000Z',
    });
  });

  it('degrada com prometheus desabilitado quando URL não está configurada', async () => {
    delete process.env.PROMETHEUS_URL;
    process.env.VIP_HEALTH_URL = 'http://vip.local/health';
    process.env.TUNNEL_HEALTH_URL = 'http://tunnel.local/health';

    databaseMock.query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('SELECT 1 as ok')) {
        return { rows: [{ ok: 1 }] };
      }
      if (text.includes('pg_is_in_recovery')) {
        return { rows: [{ is_recovery: true }] };
      }
      if (text.includes('FROM pg_stat_wal_receiver')) {
        return { rows: [{ status: 'receiving', receive_start_lsn: '0/100', received_tli: 1 }] };
      }
      if (text.includes('pg_last_wal_receive_lsn')) {
        return {
          rows: [{ receive_lsn: '0/200', replay_lsn: '0/1F0', replay_delay_seconds: 12 }],
        };
      }
      throw new Error(`Consulta inesperada: ${text}`);
    });

    global.fetch
      .mockResolvedValueOnce(createJsonResponse({ status: 'ok' })) // VIP
      .mockResolvedValueOnce(createJsonResponse({ status: 'ok' })); // Tunnel

    const response = await supertest(app).get('/api/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const { prometheus, db, exports: exportsQueue } = response.body.data;
    expect(prometheus.enabled).toBe(false);
    expect(prometheus.nodes).toEqual({});
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(db.replication.role).toBe('standby');
    expect(db.replication.replay.replay_delay_seconds).toBe(12);
    expect(exportsQueue).toBeDefined();
  });
});
