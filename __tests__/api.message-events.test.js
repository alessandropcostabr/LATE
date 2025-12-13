const express = require('express');
const supertest = require('supertest');

jest.mock('../middleware/apiKeyAuth', () => jest.fn((req, _res, next) => next()));
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, _res, next) => { req.session = { user: { id: 1, role: 'ADMIN' } }; next(); },
  requireRole: () => (_req, _res, next) => next(),
  requirePermission: () => (_req, _res, next) => next(),
  requireMessageUpdatePermission: (_req, _res, next) => next(),
}));

jest.mock('../models/messageSendEvent', () => ({
  insertIdempotent: jest.fn(),
  list: jest.fn(),
}));

const messageSendEventModel = require('../models/messageSendEvent');
const messageSendEventController = require('../controllers/messageSendEventController');
const apiKeyAuth = require('../middleware/apiKeyAuth');

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.post('/message-events', apiKeyAuth, messageSendEventController.createApi);
  app.get('/message-events', messageSendEventController.listApi);
  return supertest(app);
}

describe('Message Send Events API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('requere Idempotency-Key no POST', async () => {
    const request = createApp();
    const res = await request.post('/message-events').send({ source: 'sender-whatsapp' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Idempotency-Key/i);
    expect(messageSendEventModel.insertIdempotent).not.toHaveBeenCalled();
  });

  test('idempotência: segunda chamada retorna idempotent=true', async () => {
    messageSendEventModel.insertIdempotent
      .mockResolvedValueOnce({ row: { id: 1 }, inserted: true })
      .mockResolvedValueOnce({ row: { id: 1 }, inserted: false });

    const request = createApp();
    const headers = { 'Idempotency-Key': 'abc-123' };

    const first = await request.post('/message-events').set(headers).send({ source: 'sender-whatsapp' });
    expect(first.status).toBe(200);
    expect(first.body.idempotent).toBe(false);

    const second = await request.post('/message-events').set(headers).send({ source: 'sender-whatsapp' });
    expect(second.status).toBe(200);
    expect(second.body.idempotent).toBe(true);
  });

  test('GET lista eventos com filtros', async () => {
    messageSendEventModel.list.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const request = createApp();
    const res = await request.get('/message-events?limit=10&offset=0&source=sender-whatsapp');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(messageSendEventModel.list).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'sender-whatsapp' }),
      expect.objectContaining({ limit: 10, offset: 0 })
    );
    expect(res.body.data.length).toBe(2);
  });
});
