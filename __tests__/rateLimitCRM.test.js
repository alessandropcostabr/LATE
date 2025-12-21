const express = require('express');
const request = require('supertest');

function buildApp() {
  const { crmLimiter, crmImportLimiter } = require('../middleware/rateLimitCRM');
  const app = express();

  app.get('/crm', crmLimiter, (_req, res) => res.status(200).json({ ok: true }));
  app.post('/crm/import', crmImportLimiter, (_req, res) => res.status(200).json({ ok: true }));

  return app;
}

describe('Rate limit CRM', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.CRM_RATE_LIMIT_REDIS = '0';
    process.env.CRM_RATE_LIMIT = '2';
    process.env.CRM_RATE_WINDOW_MS = '1000';
    process.env.CRM_IMPORT_RATE_LIMIT = '2';
    process.env.CRM_IMPORT_RATE_WINDOW_MS = '1000';
  });

  test('crmLimiter bloqueia após exceder o limite', async () => {
    const app = buildApp();

    await request(app).get('/crm').expect(200);
    await request(app).get('/crm').expect(200);
    await request(app).get('/crm').expect(429);
  });

  test('crmImportLimiter bloqueia após exceder o limite', async () => {
    const app = buildApp();

    await request(app).post('/crm/import').expect(200);
    await request(app).post('/crm/import').expect(200);
    await request(app).post('/crm/import').expect(429);
  });
});
