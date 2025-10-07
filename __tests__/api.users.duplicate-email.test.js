const express = require('express');
const supertest = require('supertest');
const { body } = require('express-validator');

jest.mock('../middleware/auth', () => ({
  requireRole: () => (req, _res, next) => {
    req.session = req.session || {};
    req.session.user = { id: 1, role: 'ADMIN' };
    next();
  },
}));

jest.mock('../models/user', () => ({
  create: jest.fn(),
}));

const UserController = require('../controllers/userController');
const userModel = require('../models/user');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.post(
    '/api/users',
    body('name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    (req, _res, next) => next(),
    UserController.create,
  );

  return app;
}

describe('POST /api/users duplicate email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 409 quando o e-mail já existe', async () => {
    userModel.create.mockRejectedValueOnce({ code: '23505', constraint: 'users_email_key' });

    const app = createApp();

    const response = await supertest(app)
      .post('/api/users')
      .send({
        name: 'Usuário Teste',
        email: 'duplicado@late.test',
        password: 'Senha123!',
        role: 'OPERADOR',
      });

    expect(userModel.create).toHaveBeenCalled();
    expect(response.status).toBe(409);
    expect(response.body).toEqual({ success: false, error: 'E-mail já cadastrado' });
  });
});
