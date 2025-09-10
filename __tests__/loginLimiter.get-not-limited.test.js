// __tests__/loginLimiter.get-not-limited.test.js
const request = require('supertest');
const app = require('../server');

test('GET /login não deve retornar 429 mesmo após muitas requisições', async () => {
  const agent = request.agent(app);
  const first = await agent.get('/login').set('Accept','text/html');
  expect([200,302]).toContain(first.status);
  const limit = Number(first.headers['x-ratelimit-limit'] || 20);

  let last = first;
  for (let i = 0; i < limit + 5; i++) {
    last = await agent.get('/login').set('Accept','text/html');
    if (last.status === 429) break;
  }
  expect(last.status).not.toBe(429); // falha antes, passa depois
});
