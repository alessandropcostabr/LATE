const express = require('express');
const supertest = require('supertest');

jest.mock('../models/message', () => ({
  findById: jest.fn(),
}));

const messageModel = require('../models/message');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const apiRoutes = require('../routes/api');
  app.use('/api', apiRoutes);

  return app;
}

describe('GET /api/messages/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 200 com o recado quando o ID existe', async () => {
    messageModel.findById.mockResolvedValueOnce({
      id: 1,
      message: 'Olá mundo',
      status: 'pending',
      created_at: '2024-01-01T10:00:00Z',
      updated_at: null,
    });

    const app = createApp();
    const response = await supertest(app).get('/api/messages/1');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 1,
        message: 'Olá mundo',
        status: 'pending',
        status_label: 'Pendente',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: null,
      },
    });
    expect(messageModel.findById).toHaveBeenCalledWith(1);
  });

  it('retorna 404 quando o recado não existe', async () => {
    messageModel.findById.mockResolvedValueOnce(null);

    const app = createApp();
    const response = await supertest(app).get('/api/messages/999');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Recado não encontrado',
    });
    expect(messageModel.findById).toHaveBeenCalledWith(999);
  });

  it('retorna 400 quando o ID é inválido', async () => {
    const app = createApp();
    const response = await supertest(app).get('/api/messages/abc');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Dados inválidos',
    });
    expect(Array.isArray(response.body.details)).toBe(true);
    const idError = response.body.details.find((err) => (err.param || err.path) === 'id');
    expect(idError).toBeDefined();
    expect(idError.msg).toBe('ID inválido');
    expect(messageModel.findById).not.toHaveBeenCalled();
  });
});
