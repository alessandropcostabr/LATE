// middleware/cors.js
// Comentários em pt-BR; identificadores em inglês.
// Regras:
// - Aplica CORS apenas para /api/*
// - Allowlist por env CORS_ORIGINS (csv). Em DEV permite localhost/127.0.0.1.
// - Origin "null" bloqueado por padrão; libere com CORS_ALLOW_NULL=1 (apenas DEV recomendado).
// - Exporta ALLOWED_METHODS/ALLOWED_HEADERS pois server.js usa nos preflights.

const ALLOWED_METHODS = 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,X-CSRF-Token,X-Requested-With';

function isApiRequest(req) {
  const u = req.originalUrl || req.url || '';
  return u.startsWith('/api/');
}

function parseAllowlist() {
  const raw = process.env.CORS_ORIGINS || '';
  const list = raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Em não-produção, garantir localhost/127.0.0.1
  const isProd = String(process.env.NODE_ENV).toLowerCase() === 'production';
  if (!isProd) {
    const devs = new Set([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://localhost:3000',
      'https://127.0.0.1:3000'
    ]);
    for (const o of devs) if (!list.includes(o)) list.push(o);
  }
  return list;
}

function corsMiddleware(req, res, next) {
  // Só tratamos CORS na API
  if (!isApiRequest(req)) return next();

  const origin = req.headers.origin;
  const allowlist = parseAllowlist();
  const isProd = String(process.env.NODE_ENV).toLowerCase() === 'production';

  // Requisição sem Origin (ex.: curl, same-origin) -> segue
  if (!origin) return next();

  // Origin 'null' (file://, sandbox)
  if (origin === 'null') {
    if (!isProd && process.env.CORS_ALLOW_NULL === '1') {
      // leitura pública; sem credenciais
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Vary', 'Origin');
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
        res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
        res.setHeader('Access-Control-Max-Age', '600');
        return res.sendStatus(204);
      }
      return next();
    }
    return res
      .status(403)
      .json({ success: false, error: 'Origem não permitida: null' });
  }

  // Origin presente: precisa estar na allowlist
  if (!allowlist.includes(origin)) {
    res.setHeader('Vary', 'Origin');
    return res
      .status(403)
      .json({ success: false, error: `Origem não permitida: ${origin}` });
  }

  // Origin permitido
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Vary', 'Origin');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '600'); // 10 min
    return res.sendStatus(204);
  }

  return next();
}

// Exporta constantes (server.js usa em preflight global)
corsMiddleware.ALLOWED_METHODS = ALLOWED_METHODS;
corsMiddleware.ALLOWED_HEADERS = ALLOWED_HEADERS;

module.exports = corsMiddleware;

