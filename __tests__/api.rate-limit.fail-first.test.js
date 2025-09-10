const request = require('supertest');
const app = require('../server');

describe('API rate limit aplicado em /api (fail-first)', () => {
  it('NÃO deveria estourar 429 em GET /api/stats (mas hoje estoura)', async () => {
    const agent = request.agent(app);

    // tenta inferir o limite pelas headers do /login (compartilham config)
    const head = await agent.get('/login').set('Accept', 'text/html');
    const limit = Number(head.headers['x-ratelimit-limit'] || 20);

    let lastStatus = 200;
    for (let i = 0; i < limit + 5; i++) {
      const res = await agent.get('/api/stats').set('Accept', 'application/json');
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }

    // Expectativa desejada (após o patch) é NÃO 429.
    // Hoje, ANTES do patch, isso deve FALHAR (lastStatus === 429).
    expect(lastStatus).not.toBe(429);
  });
});
