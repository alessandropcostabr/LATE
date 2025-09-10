const path = require('path');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

let app;

beforeAll(() => {
  app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.locals.cssFile = '/css/style.css';
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(session({ secret: 'test', resave: false, saveUninitialized: false }));
  app.use((req, res, next) => {
    res.locals.user = req.session.user;
    next();
  });
  const webRoutes = require('../routes/web');
  app.use(webRoutes);
});

afterAll(() => {
  const dbManager = require('../config/database');
  dbManager.close();
  const fs = require('fs');
  const dbPath = path.join(__dirname, '..', 'data', 'recados.db');
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});

describe('GET /register', () => {
  test('responds with 200 or 403 and never 500', async () => {
    const res = await request(app).get('/register');
    expect([200, 403]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});
