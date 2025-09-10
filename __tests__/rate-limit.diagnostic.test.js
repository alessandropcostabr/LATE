// __tests__/rate-limit.diagnostic.test.js
const request = require('supertest');
const app = require('../server');

describe('Rate limit – diagnóstico', () => {
  it('atinge 429 e exibe a mensagem padrão em ~max+1 requisições', async () => {
    const agent = request.agent(app);

    // 1) Primeira chamada revela o teto (via headers)
    const first = await agent
      .post('/login')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', '1.2.3.4');
    expect([200, 302, 400, 401, 403]).toContain(first.status);

    const limit = Number(first.headers['x-ratelimit-limit'] || 20);
    expect(Number.isFinite(limit) && limit > 0).toBe(true);

    // 2) Consumir o saldo até estourar
    let last = first;
    for (let i = 0; i < limit + 2; i++) {
      last = await agent
        .post('/login')
        .set('Accept', 'application/json')
        .set('X-Forwarded-For', '1.2.3.4');
      // Permitimos respostas enquanto houver saldo; ao estourar deve virar 429
      if (last.status === 429) break;
    }

    // 3) Verifica que houve bloqueio por rate limit
    expect(last.status).toBe(429);
    const body = typeof last.body === 'object' ? last.body : {};
    const msg = body.error || body.message || (last.text || '').slice(0, 120);
    expect(String(msg)).toMatch(/Muitas requisições/i);
  });
});
