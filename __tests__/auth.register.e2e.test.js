const request = require('supertest');
const app = require('../server');

function getCsrf(html) {
  const m = html && html.match(/name="(_csrf|csrfToken)".*?value="([^"]+)"/i);
  return m ? m[2] : null;
}

describe('Cadastro de usuário (E2E)', () => {
  it('registra e redireciona para /login', async () => {
    const agent = request.agent(app);

    // 1) Tenta /register e aceita redirecionar 1x (ex.: para /login)
    let res = await agent.get('/register').set('Accept', 'text/html').redirects(1);
    expect([200, 302]).toContain(res.status);

    // 2) Se ainda for 302 sem corpo útil, segue manualmente
    if (res.status === 302 && res.headers.location) {
      const loc = res.headers.location;
      res = await agent.get(loc).set('Accept', 'text/html');
      expect(res.status).toBe(200);
    }

    const token = getCsrf(res.text);
    expect(token).toBeTruthy();

    // 3) POST /register com CSRF válido
    const email = `teste.cors.${Date.now()}@exemplo.com`;
    const post = await agent
      .post('/register')
      .type('form')
      .send({ _csrf: token, name: 'Teste CORS', email, password: 'SenhaSegura@123' })
      .redirects(0);

    expect([302, 303]).toContain(post.status);
    expect(post.headers.location).toBe('/login');
  });
});
