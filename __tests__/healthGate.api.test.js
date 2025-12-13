const express = require('express');
const supertest = require('supertest');

jest.mock('../config/database', () => ({
  connect: jest.fn(() => { throw new Error('db down'); }),
}));

const healthGate = require('../middleware/healthGate');

function createApp() {
  const app = express();
  app.use('/api', healthGate, (req, res) => res.json({ success: true }));
  return supertest(app);
}

describe('healthGate middleware para API', () => {
  test('quando DB indisponível, responde 503 JSON', async () => {
    const request = createApp();
    const res = await request.get('/api/fail');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('DB_UNAVAILABLE');
    expect(res.type).toMatch(/json/);
  });
});
