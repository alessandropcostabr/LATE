const express = require('express');
const { body } = require('express-validator');
const supertest = require('supertest');

const authController = require('../controllers/authController');

describe('POST /login without CSRF middleware', () => {
  function createApp() {
    const app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    // Simula sessão mínima utilizada pelo controller
    app.use((req, _res, next) => {
      req.session = req.session || {};
      next();
    });

    // Stub de renderização que devolve JSON com os dados usados na view
    app.use((req, res, next) => {
      res.render = (view, locals = {}) => {
        res.type('application/json');
        return res.send({ view, locals });
      };
      next();
    });

    app.post(
      '/login',
      body('email').isEmail(),
      body('password').notEmpty(),
      authController.login
    );

    return app;
  }

  it('retorna 400 renderizando a view de login mesmo sem token CSRF', async () => {
    const app = createApp();

    const response = await supertest(app)
      .post('/login')
      .set('Accept', 'text/html')
      .type('form')
      .send({ email: 'usuario-sem-token', password: '' });

    expect(response.status).toBe(400);
    expect(response.body.view).toBe('login');
    expect(response.body.locals.title).toBe('Login');
    expect(response.body.locals.csrfToken).toBeUndefined();
    expect(Array.isArray(response.body.locals.errors)).toBe(true);
    expect(response.body.locals.errors.length).toBeGreaterThan(0);
  });
});
