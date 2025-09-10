const request = require('supertest');
const app = require('../server');

function getCsrf(html) {
  const m = html && html.match(/name="(_csrf|csrfToken)".*?value="([^"]+)"/i);
  return m ? m[2] : null;
}

describe('Login JSON responses', () => {
  test('retorna JSON quando Accept inclui application/json', async () => {
    const agent = request.agent(app);

    const res = await agent.get('/login').set('Accept', 'text/html');
    expect(res.status).toBe(200);
    const token = getCsrf(res.text);
    expect(token).toBeTruthy();

    const post = await agent
      .post('/login')
      .set('Accept', 'application/json')
      .send({ email: 'naoexiste@example.com', password: 'senha', _csrf: token });

    expect(post.status).toBe(401);
    expect(post.type).toMatch(/json/);
    expect(post.body).toEqual({ error: 'Credenciais inválidas' });
  });
});
