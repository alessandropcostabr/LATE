const express = require('express');
const supertest = require('supertest');

jest.mock('../models/message', () => ({
  findById: jest.fn(),
  updateRecipient: jest.fn(),
}));

jest.mock('../models/contact', () => ({
  updateFromMessage: jest.fn(),
}));

jest.mock('../models/user', () => ({
  findById: jest.fn(),
  getActiveUsersBySector: jest.fn(),
  getActiveUsersSelect: jest.fn(),
}));

jest.mock('../models/sector', () => ({
  getById: jest.fn(),
  list: jest.fn(),
}));

jest.mock('../services/emailQueue', () => ({
  enqueueTemplate: jest.fn(() => Promise.resolve()),
}));

jest.mock('../middleware/csrf', () => jest.fn((req, _res, next) => next()));

const messageModel = require('../models/message');
const userModel = require('../models/user');
const sectorModel = require('../models/sector');
const emailQueue = require('../services/emailQueue');

function createApp(role = 'admin') {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use((req, _res, next) => {
    req.session = {
      user: {
        id: 99,
        name: 'Supervisor Teste',
        role,
        sessionVersion: 1,
      },
      sessionVersion: 1,
      destroy: (cb) => (typeof cb === 'function' ? cb() : undefined),
      cookie: {},
    };
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

describe('POST /api/messages/:id/forward', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userModel.findById.mockImplementation(async (id) => ({
      id,
      name: id === 99 ? 'Supervisor Teste' : `Usuário ${id}`,
      email: id === 99 ? 'supervisor@late.dev' : `user${id}@late.dev`,
      role: id === 99 ? 'ADMIN' : 'OPERADOR',
      is_active: true,
      view_scope: 'all',
      session_version: 1,
    }));
  });

  it('encaminha recado para um novo usuário e envia notificação', async () => {
    messageModel.findById
      .mockResolvedValueOnce({
        id: 1,
        recipient_user_id: 10,
        recipient_sector_id: null,
        recipient: 'Usuário Atual',
        call_date: '2024-01-01',
        call_time: '10:00',
        sender_name: 'Cliente',
        sender_phone: '1199999999',
        sender_email: 'cliente@example.com',
        subject: 'Retorno',
        message: 'Mensagem original',
        status: 'pending',
        visibility: 'private',
        notes: '',
      })
      .mockResolvedValueOnce({
        id: 1,
        recipient_user_id: 2,
        recipient_sector_id: null,
        recipient: 'Maria Destinatária',
        call_date: '2024-01-01',
        call_time: '10:00',
        sender_name: 'Cliente',
        sender_phone: '1199999999',
        sender_email: 'cliente@example.com',
        subject: 'Retorno',
        message: 'Mensagem original',
        status: 'pending',
        visibility: 'private',
        notes: '',
      });

    messageModel.updateRecipient.mockResolvedValue(true);

    userModel.findById.mockImplementation(async (id) => {
      if (id === 99) {
        return {
          id: 99,
          name: 'Supervisor Teste',
          email: 'supervisor@late.dev',
          role: 'ADMIN',
          is_active: true,
          view_scope: 'all',
          session_version: 1,
        };
      }
      if (id === 2) {
        return {
          id: 2,
          name: 'Maria Destinatária',
          email: 'dest@example.com',
          role: 'OPERADOR',
          is_active: true,
          view_scope: 'all',
          session_version: 1,
        };
      }
      return {
        id,
        name: `Usuário ${id}`,
        email: `user${id}@late.dev`,
        role: 'OPERADOR',
        is_active: true,
        view_scope: 'all',
        session_version: 1,
      };
    });

    const app = createApp('admin');
    const response = await supertest(app)
      .post('/api/messages/1/forward')
      .send({ recipientUserId: 2 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: expect.objectContaining({
        id: 1,
        recipientUserId: 2,
        recipient: 'Maria Destinatária',
      }),
    });
    expect(messageModel.updateRecipient).toHaveBeenCalledWith(1, {
      recipient: 'Maria Destinatária',
      recipient_user_id: 2,
      recipient_sector_id: null,
    });
    expect(userModel.findById).toHaveBeenCalledWith(2);
    expect(emailQueue.enqueueTemplate).toHaveBeenCalledWith(expect.objectContaining({
      to: 'dest@example.com',
      template: 'contact-forward',
    }));
  });

  it('retorna 400 quando o destinatário é o mesmo usuário', async () => {
    messageModel.findById.mockResolvedValue({
      id: 1,
      recipient_user_id: 2,
      recipient_sector_id: null,
      recipient: 'Maria Destinatária',
    });
    userModel.findById.mockImplementation(async (id) => {
      if (id === 99) {
        return {
          id: 99,
          name: 'Supervisor Teste',
          email: 'supervisor@late.dev',
          role: 'ADMIN',
          is_active: true,
          view_scope: 'all',
          session_version: 1,
        };
      }
      if (id === 2) {
        return {
          id: 2,
          name: 'Maria Destinatária',
          email: 'dest@example.com',
          role: 'OPERADOR',
          is_active: true,
          view_scope: 'all',
          session_version: 1,
        };
      }
      return {
        id,
        name: `Usuário ${id}`,
        email: `user${id}@late.dev`,
        role: 'OPERADOR',
        is_active: true,
        view_scope: 'all',
        session_version: 1,
      };
    });

    const app = createApp('admin');
    const response = await supertest(app)
      .post('/api/messages/1/forward')
      .send({ recipientUserId: 2 });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: expect.stringContaining('destinatário diferente'),
    });
    expect(messageModel.updateRecipient).not.toHaveBeenCalled();
    expect(emailQueue.enqueueTemplate).not.toHaveBeenCalled();
  });

  it('encaminha recado para um setor sem enviar e-mail', async () => {
    messageModel.findById
      .mockResolvedValueOnce({
        id: 1,
        recipient_user_id: 5,
        recipient_sector_id: null,
        recipient: 'Usuário Original',
      })
      .mockResolvedValueOnce({
        id: 1,
        recipient_user_id: null,
        recipient_sector_id: 7,
        recipient: 'Atendimento',
        call_date: '2024-01-01',
        call_time: '08:00',
        sender_name: 'Cliente',
        sender_phone: '1188887777',
        sender_email: 'cli@example.com',
        subject: 'Ajuda',
        message: 'Mensagem teste',
        status: 'pending',
        visibility: 'private',
        notes: '',
      });

    messageModel.updateRecipient.mockResolvedValue(true);

    sectorModel.getById.mockResolvedValue({
      id: 7,
      name: 'Atendimento',
      is_active: true,
    });

    const app = createApp('admin');
    const response = await supertest(app)
      .post('/api/messages/1/forward')
      .send({ recipientType: 'sector', recipientSectorId: 7 });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      recipientSectorId: 7,
      recipient: 'Atendimento',
    });
    expect(messageModel.updateRecipient).toHaveBeenCalledWith(1, {
      recipient: 'Atendimento',
      recipient_user_id: null,
      recipient_sector_id: 7,
    });
    expect(emailQueue.enqueueTemplate).not.toHaveBeenCalled();
  });
});
