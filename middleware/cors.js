// middleware/cors.js
// CORS centralizado — identificadores em inglês, mensagens em pt-BR.
// Regra: origens definidas por env (CORS_ORIGINS, separadas por vírgula),
// mais fallbacks locais e domínios obrigatórios do projeto.

const REQUIRED_ORIGINS = [
  'http://late.miahchat.com',
  'https://late.miahchat.com',
];

const FALLBACK_ORIGINS = [
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://localhost',
];

const ENV_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...REQUIRED_ORIGINS,
  ...FALLBACK_ORIGINS,
  ...ENV_ORIGINS,
]);

const METHODS = 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
const ALLOWED_HEADERS_LIST = ['Content-Type', 'X-CSRF-Token', 'X-Requested-With'];
const ALLOWED_HEADERS = ALLOWED_HEADERS_LIST.join(',');

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  // Requisições sem Origin (curl/health checks) passam direto
  if (!origin) return next();

  if (!allowedOrigins.has(origin)) {
    console.warn(`[CORS] Origem não permitida: ${origin}`);
    res.setHeader('Vary', 'Origin');
    return res.status(403).json({ success: false, error: `Origem não permitida: ${origin}` });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Vary', 'Origin');

  // Responder preflight imediatamente
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '600'); // 10 min
    return res.sendStatus(204);
  }

  return next();
};

corsMiddleware.ALLOWED_METHODS = METHODS;
corsMiddleware.ALLOWED_HEADERS = ALLOWED_HEADERS;
corsMiddleware.ALLOWED_HEADERS_LIST = ALLOWED_HEADERS_LIST;

module.exports = corsMiddleware;
