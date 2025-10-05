const express = require('express');
const supertest = require('supertest');

jest.mock('../controllers/messageController', () => {
  const createResponder = (status = 200) => jest.fn((_req, res) => {
    res.status(status).json({ success: true });
  });

  return {
    list: createResponder(),
    show: createResponder(),
    getById: createResponder(),
    create: createResponder(201),
    update: createResponder(),
    updateStatus: createResponder(),
    remove: createResponder(),
  };
});

jest.mock('../controllers/statsController', () => ({
  messagesStats: jest.fn((_req, res) => res.json({ success: true })),
  byStatus: jest.fn((_req, res) => res.json({ success: true })),
  byRecipient: jest.fn((_req, res) => res.json({ success: true })),
  byMonth: jest.fn((_req, res) => res.json({ success: true })),
}));

const messageController = require('../controllers/messageController');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const apiRoutes = require('../routes/api');
  app.use('/api', apiRoutes);

  return app;
}

describe('API message validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 400 para limit inválido em GET /messages', async () => {
    const app = createApp();

    const response = await supertest(app)
      .get('/api/messages')
      .query({ limit: 'foo' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Dados inválidos',
    });
    expect(Array.isArray(response.body.details)).toBe(true);
    const limitError = response.body.details.find((err) => (err.param || err.path) === 'limit');
    expect(limitError).toBeDefined();
    expect(limitError.msg).toBe('limit inválido');
    expect(messageController.list).not.toHaveBeenCalled();
  });

  it('retorna 400 para status inválido em PATCH /messages/:id/status', async () => {
    const app = createApp();

    const response = await supertest(app)
      .patch('/api/messages/1/status')
      .send({ status: 'zzz' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Dados inválidos',
    });
    expect(Array.isArray(response.body.details)).toBe(true);
    const statusError = response.body.details.find((err) => (err.param || err.path) === 'status');
    expect(statusError).toBeDefined();
    expect(statusError.msg).toMatch(/Status/);
    expect(messageController.updateStatus).not.toHaveBeenCalled();
  });
});

