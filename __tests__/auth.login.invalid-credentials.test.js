const express = require('express');
const { body } = require('express-validator');
const supertest = require('supertest');

jest.mock('../models/user', () => ({
  findByEmail: jest.fn().mockResolvedValue(null),
}));

const authController = require('../controllers/authController');
const userModel = require('../models/user');

describe('POST /login with invalid credentials (JSON)', () => {
  function createApp() {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    app.use((req, _res, next) => {
      req.session = req.session || {};
      next();
    });

    app.post(
      '/login',
      body('email').isEmail(),
      body('password').notEmpty(),
      authController.login,
    );

    return app;
  }

  it('retorna 401 com JSON e mensagem em pt-BR', async () => {
    const app = createApp();

    const response = await supertest(app)
      .post('/login')
      .set('Accept', 'application/json')
      .send({ email: 'inexistente@late.test', password: 'senha' });

    expect(userModel.findByEmail).toHaveBeenCalledWith('inexistente@late.test');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Credenciais inválidas' });
  });
});
