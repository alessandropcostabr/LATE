const path = require('path');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

function createApp(sessionUser) {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.cssFile = '/css/style.css';
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, res, next) => {
    if (sessionUser) {
      req.session.user = sessionUser;
    }
    res.locals.user = req.session.user;
    next();
  });
  const webRoutes = require('../routes/web');
  app.use(webRoutes);
  return app;
}

afterAll(() => {
  const dbManager = require('../config/database');
  dbManager.close();
  const fs = require('fs');
  const dbPath = path.join(__dirname, '..', 'data', 'recados.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('GET /register', () => {
  test('redirects to /login if not authenticated', async () => {
    const app = createApp();
    const res = await request(app).get('/register');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('returns 403 for non-admin user', async () => {
    const app = createApp({ role: 'OPERADOR' });
    const res = await request(app).get('/register');
    expect(res.status).toBe(403);
  });

  test('renders register page for admin user', async () => {
    const app = createApp({ role: 'ADMIN' });
    const res = await request(app).get('/register');
    expect(res.status).toBe(200);
  });
});

