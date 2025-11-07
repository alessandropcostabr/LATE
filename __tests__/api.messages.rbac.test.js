const express = require('express');
const supertest = require('supertest');

const mockFindById = jest.fn();
const mockRoleState = { value: 'READER' };

jest.mock('../models/message', () => ({
  findById: (...args) => mockFindById(...args),
}));

jest.mock('../models/user', () => ({
  findById: jest.fn(async (id) => ({
    id,
    name: 'Test User',
    email: 'user@example.com',
    role: mockRoleState.value.toUpperCase(),
    is_active: true,
    view_scope: 'all',
    session_version: 1,
  })),
}));

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

  return {
    list: jest.fn((_req, res) => res.json({ success: true, data: 'list' })),
    getById: jest.fn((_req, res) => res.json({ success: true, data: 'item' })),
    create: jest.fn((_req, res) => res.status(201).json({ success: true })),
    update: jest.fn((_req, res) => res.json({ success: true })),
    forward: jest.fn((_req, res) => res.json({ success: true })),
    updateStatus: jest.fn((_req, res) => res.json({ success: true })),
    listRelated: jest.fn((_req, res) => res.json({ success: true, data: [] })),
    remove: jest.fn((_req, res) => res.json({ success: true })),
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

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, _res, next) => {
    const roleHeader = req.get('x-test-role');
    if (roleHeader !== undefined) {
      const normalizedRole = roleHeader && roleHeader !== 'none'
        ? String(roleHeader)
        : undefined;
      mockRoleState.value = normalizedRole ? normalizedRole : 'reader';
      req.session = {
        user: {
          id: 1,
          name: 'Test User',
          role: normalizedRole,
          sessionVersion: 1,
        },
        sessionVersion: 1,
        destroy: jest.fn((cb) => cb?.()),
        cookie: {},
      };
    }
    next();
  });

  const apiRoutes = require('../routes/api');
  app.use('/api', apiRoutes);

  const originalListen = app.listen.bind(app);
  app.listen = function patchedListen(port, host, callback) {
    if (typeof port === 'function') {
      callback = port;
      port = 0;
      host = '127.0.0.1';
    } else if (typeof host === 'function') {
      callback = host;
      host = '127.0.0.1';
    }
    if (typeof port !== 'number' || Number.isNaN(port)) {
      port = 0;
    }
    if (typeof host !== 'string') {
      host = '127.0.0.1';
    }
    return originalListen(port, host, callback);
  };

  return app;
}

function expectForbidden(response) {
  expect(response.status).toBe(403);
  expect(response.body).toEqual({ success: false, error: 'Acesso negado' });
}

describe('RBAC for /api/messages* routes', () => {
  let app;

beforeEach(() => {
  jest.clearAllMocks();
  mockFindById.mockReset();
  mockRoleState.value = 'READER';
  app = createApp();
});

  it('bloqueia requisições sem sessão', async () => {
    const response = await supertest(app).get('/api/messages');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Não autenticado' });
    expect(messageController.list).not.toHaveBeenCalled();
  });

  it('permite leitura para reader e impede criação', async () => {
    const listResponse = await supertest(app)
      .get('/api/messages')
      .set('x-test-role', 'reader');
    expect(listResponse.status).toBe(200);
    expect(messageController.list).toHaveBeenCalled();

    const createResponse = await supertest(app)
      .post('/api/messages')
      .set('x-test-role', 'reader')
      .send({ message: 'Olá', recipientId: 1 });
    expectForbidden(createResponse);
    expect(messageController.create).not.toHaveBeenCalled();

    const forwardResponse = await supertest(app)
      .post('/api/messages/1/forward')
      .set('x-test-role', 'reader')
      .send({ recipientUserId: 2 });
    expectForbidden(forwardResponse);
    expect(messageController.forward).not.toHaveBeenCalled();
  });

  it('permite criação e edição do próprio recado para operator, mas bloqueia encaminhamento', async () => {
    const createResponse = await supertest(app)
      .post('/api/messages')
      .set('x-test-role', 'operator')
      .send({ message: 'Olá', recipientId: 1 });
    expect(createResponse.status).toBe(201);
    expect(messageController.create).toHaveBeenCalled();

    mockFindById.mockResolvedValueOnce({ id: 1, created_by: 1 });
    const updateResponse = await supertest(app)
      .put('/api/messages/1')
      .set('x-test-role', 'operator')
      .send({ message: 'Atualizado' });
    expect(updateResponse.status).toBe(200);
    expect(messageController.update).toHaveBeenCalled();

    const forwardResponse = await supertest(app)
      .post('/api/messages/1/forward')
      .set('x-test-role', 'operator')
      .send({ recipientUserId: 3 });
    expectForbidden(forwardResponse);
    expect(messageController.forward).not.toHaveBeenCalled();
  });

  it('permite operator atualizar recado recebido', async () => {
    mockFindById.mockResolvedValueOnce({ id: 9, created_by: 2, recipient_user_id: 1 });

    const updateResponse = await supertest(app)
      .put('/api/messages/9')
      .set('x-test-role', 'operator')
      .send({ message: 'Follow-up' });

    expect(updateResponse.status).toBe(200);
    expect(messageController.update).toHaveBeenCalled();
  });

  it('bloqueia operator ao tentar editar recado de outro usuário', async () => {
    mockFindById.mockResolvedValueOnce({ id: 7, created_by: 2 });

    const response = await supertest(app)
      .put('/api/messages/7')
      .set('x-test-role', 'operator')
      .send({ message: 'Sem permissão' });

    expectForbidden(response);
    expect(messageController.update).not.toHaveBeenCalled();
  });

  it('permite atualização para supervisor mas bloqueia remoção', async () => {
    const updateResponse = await supertest(app)
      .patch('/api/messages/1/status')
      .set('x-test-role', 'supervisor')
      .send({ status: 'resolved' });
    expect(updateResponse.status).toBe(200);
    expect(messageController.updateStatus).toHaveBeenCalled();

    const forwardResponse = await supertest(app)
      .post('/api/messages/1/forward')
      .set('x-test-role', 'supervisor')
      .send({ recipientUserId: 4 });
    expect(forwardResponse.status).toBe(200);
    expect(messageController.forward).toHaveBeenCalled();

    const deleteResponse = await supertest(app)
      .delete('/api/messages/1')
      .set('x-test-role', 'supervisor');
    expectForbidden(deleteResponse);
    expect(messageController.remove).not.toHaveBeenCalled();
  });

  it('permite todas as ações para admin', async () => {
    const responses = await Promise.all([
      supertest(app).get('/api/messages').set('x-test-role', 'admin'),
      supertest(app).post('/api/messages').set('x-test-role', 'admin').send({ message: 'Olá', recipientId: 1 }),
      supertest(app).put('/api/messages/1').set('x-test-role', 'admin').send({ message: 'Atualizado' }),
      supertest(app).patch('/api/messages/1/status').set('x-test-role', 'admin').send({ status: 'resolved' }),
      supertest(app).post('/api/messages/1/forward').set('x-test-role', 'admin').send({ recipientUserId: 6 }),
      supertest(app).delete('/api/messages/1').set('x-test-role', 'admin'),
    ]);

    expect(responses.map((res) => res.status)).toEqual([200, 201, 200, 200, 200, 200]);
    expect(messageController.list).toHaveBeenCalled();
    expect(messageController.create).toHaveBeenCalled();
    expect(messageController.update).toHaveBeenCalled();
    expect(messageController.updateStatus).toHaveBeenCalled();
    expect(messageController.forward).toHaveBeenCalled();
    expect(messageController.remove).toHaveBeenCalled();
  });

  it('trata usuário sem role como reader por padrão', async () => {
    const createResponse = await supertest(app)
      .post('/api/messages')
      .set('x-test-role', 'none')
      .send({ message: 'Olá', recipientId: 1 });
    expectForbidden(createResponse);
    expect(messageController.create).not.toHaveBeenCalled();

    const listResponse = await supertest(app)
      .get('/api/messages')
      .set('x-test-role', 'none');
    expect(listResponse.status).toBe(200);
    expect(messageController.list).toHaveBeenCalled();

    const forwardResponse = await supertest(app)
      .post('/api/messages/1/forward')
      .set('x-test-role', 'none')
      .send({ recipientUserId: 2 });
    expectForbidden(forwardResponse);
    expect(messageController.forward).not.toHaveBeenCalled();
  });
});
