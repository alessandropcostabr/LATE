// middleware/cors.js
// Comentários em pt-BR; identificadores em inglês.
//
// Regras:
// - Aplica CORS somente para requisições da API (/api/*).
// - Se não houver Origin: NÃO é CORS -> permite (forms same-origin, curl, server-side).
// - Permite múltiplas origens via env CORS_ORIGINS (separadas por vírgula).
// - Preflight (OPTIONS) retorna 204.
// - Origin "null" (file://, extensões) é bloqueado por padrão — libere com CORS_ALLOW_NULL=1.

const DEFAULT_ALLOWLIST = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://late.miahchat.com',
];

// Concatena allowlist padrão + valores vindos do env (sem duplicatas)
function parseAllowlist() {
  const extra = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_ALLOWLIST, ...extra]));
}

// Detecta se a requisição é para a API independente de como foi montado o middleware
function isApiRequest(req) {
  const url = req.originalUrl || req.url || '';
  const base = req.baseUrl || '';
  const path = req.path || '';

  return (
    url.startsWith('/api/') ||
    base.startsWith('/api') ||
    path.startsWith('/api/')
  );
}

module.exports = function corsMiddleware(req, res, next) {
  // ✅ Só aplicar CORS na API
  if (!isApiRequest(req)) return next();

  const origin = req.headers.origin;
  const allowlist = parseAllowlist();

  // Sem Origin => não é uma requisição CORS (ex.: form same-origin)
  if (!origin) return next();

  // Origin "null" (file://, sandbox). Bloqueado por padrão por segurança.
  if (origin === 'null') {
    if (process.env.CORS_ALLOW_NULL === '1') {
      // Em null origin não usamos credenciais; devolvemos '*' apenas para leitura pública.
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token,X-Requested-With');
        res.setHeader('Access-Control-Max-Age', '600');
        return res.status(204).end();
      }
      return next();
    }
    return res.status(403).json({ success: false, error: 'Origem não permitida: null' });
  }

  // Origin presente: precisa estar na allowlist
  if (allowlist.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token,X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '600');

    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  }

  // Origin não permitido
  return res.status(403).json({ success: false, error: `Origem não permitida: ${origin}` });
};

