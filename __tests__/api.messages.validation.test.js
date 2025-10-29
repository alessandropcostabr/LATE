const express = require('express');
const supertest = require('supertest');

jest.mock('../controllers/messageController', () => {
  const dispatchBackground = jest.fn((_task, fn) => {
    if (typeof fn === 'function') {
      try {
        const result = fn();
        return result && typeof result.then === 'function' ? result : Promise.resolve(result);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return Promise.resolve();
  });
  const createResponder = (status = 200) => jest.fn((_req, res) => {
    res.status(status).json({ success: true });
  });

  return {
    list: createResponder(),
    show: createResponder(),
    getById: createResponder(),
    create: createResponder(201),
    update: createResponder(),
    forward: createResponder(),
    updateStatus: createResponder(),
    remove: createResponder(),
    __internals: {
      sanitizePayload: jest.fn((payload) => ({ ...payload })),
      extractRecipientInput: jest.fn((body) => ({ ...body })),
      resolveRecipientTarget: jest.fn(async (input = {}) => ({
        recipient: input.recipient || null,
        recipient_user_id: input.recipientUserId ?? input.recipient_user_id ?? null,
        recipient_sector_id: input.recipientSectorId ?? input.recipient_sector_id ?? null,
        error: null,
      })),
      notifyRecipientUser: jest.fn(),
      notifyRecipientSectorMembers: jest.fn(),
      logMessageEvent: jest.fn(),
      dispatchBackground,
      attachCreatorNames: jest.fn(async (rows) => rows),
    },
  };
});

jest.mock('../controllers/statsController', () => ({
  messagesStats: jest.fn((_req, res) => res.json({ success: true })),
  byStatus: jest.fn((_req, res) => res.json({ success: true })),
  byRecipient: jest.fn((_req, res) => res.json({ success: true })),
  byMonth: jest.fn((_req, res) => res.json({ success: true })),
}));

jest.mock('../middleware/csrf', () => jest.fn((req, _res, next) => next()));

const messageController = require('../controllers/messageController');

function createApp(role = 'admin') {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, _res, next) => {
    if (role) {
      req.session = {
        user: {
          id: 1,
          name: 'Test User',
          role,
        },
      };
    }
    next();
  });

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
    expect(Array.isArray(response.body.data?.details)).toBe(true);
    const limitError = response.body.data.details.find((err) => (err.param || err.path) === 'limit');
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
    expect(Array.isArray(response.body.data?.details)).toBe(true);
    const statusError = response.body.data.details.find((err) => (err.param || err.path) === 'status');
    expect(statusError).toBeDefined();
    expect(statusError.msg).toMatch(/Status/);
    expect(messageController.updateStatus).not.toHaveBeenCalled();
  });
});
