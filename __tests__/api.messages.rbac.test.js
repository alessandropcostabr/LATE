const express = require('express');
const supertest = require('supertest');

jest.mock('../controllers/messageController', () => ({
  list: jest.fn((_req, res) => res.json({ success: true, data: 'list' })),
  getById: jest.fn((_req, res) => res.json({ success: true, data: 'item' })),
  create: jest.fn((_req, res) => res.status(201).json({ success: true })),
  update: jest.fn((_req, res) => res.json({ success: true })),
  updateStatus: jest.fn((_req, res) => res.json({ success: true })),
  remove: jest.fn((_req, res) => res.json({ success: true })),
}));

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
      req.session = {
        user: {
          id: 1,
          name: 'Test User',
        },
      };
      if (roleHeader !== 'none') {
        req.session.user.role = roleHeader;
      }
    }
    next();
  });

  const apiRoutes = require('../routes/api');
  app.use('/api', apiRoutes);

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
  });

  it('permite criação para operator mas bloqueia atualização completa', async () => {
    const createResponse = await supertest(app)
      .post('/api/messages')
      .set('x-test-role', 'operator')
      .send({ message: 'Olá', recipientId: 1 });
    expect(createResponse.status).toBe(201);
    expect(messageController.create).toHaveBeenCalled();

    const updateResponse = await supertest(app)
      .put('/api/messages/1')
      .set('x-test-role', 'operator')
      .send({ message: 'Atualizado' });
    expectForbidden(updateResponse);
    expect(messageController.update).not.toHaveBeenCalled();
  });

  it('permite atualização para supervisor mas bloqueia remoção', async () => {
    const updateResponse = await supertest(app)
      .patch('/api/messages/1/status')
      .set('x-test-role', 'supervisor')
      .send({ status: 'resolved' });
    expect(updateResponse.status).toBe(200);
    expect(messageController.updateStatus).toHaveBeenCalled();

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
      supertest(app).delete('/api/messages/1').set('x-test-role', 'admin'),
    ]);

    expect(responses.map((res) => res.status)).toEqual([200, 201, 200, 200, 200]);
    expect(messageController.list).toHaveBeenCalled();
    expect(messageController.create).toHaveBeenCalled();
    expect(messageController.update).toHaveBeenCalled();
    expect(messageController.updateStatus).toHaveBeenCalled();
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
  });
});
