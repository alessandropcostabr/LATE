const express = require('express');
const supertest = require('supertest');

jest.mock('../config/database', () => ({
  query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
}));

const healthController = require('../controllers/healthController');
const metaController = require('../controllers/metaController');

describe('API utilitários', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.get('/api/health', healthController.apiCheck);
    app.get('/api/version', metaController.version);
  });

  it('retorna status ok em GET /api/health', async () => {
    const response = await supertest(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: 'ok' });
  });

  it('retorna env e commit em GET /api/version', async () => {
    const previousEnv = process.env.NODE_ENV;
    const previousCommit = process.env.GIT_COMMIT;
    process.env.NODE_ENV = 'production';
    process.env.GIT_COMMIT = 'abc123';

    try {
      const response = await supertest(app).get('/api/version');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          env: 'production',
          commit: 'abc123',
        },
      });
    } finally {
      if (previousEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousEnv;
      }
      if (previousCommit === undefined) {
        delete process.env.GIT_COMMIT;
      } else {
        process.env.GIT_COMMIT = previousCommit;
      }
    }
  });
});
