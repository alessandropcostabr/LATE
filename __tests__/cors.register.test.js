// __tests__/cors.register.test.js
const request = require('supertest');
const app = require('../server'); // ajuste se exportar httpServer

describe('CORS em /register', () => {
  test('Origem externa não deve receber 403 (sem headers CORS)', async () => {
    const res = await request(app)
      .get('/register')
      .set('Origin', 'https://google.com');

    expect(res.status).not.toBe(403); // falha ANTES do patch, passa DEPOIS
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
