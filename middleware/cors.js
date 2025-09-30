// middleware/cors.js

const REQUIRED_ORIGINS = [
  'http://late.miahchat.com',
  'https://late.miahchat.com'
];

const FALLBACK_ORIGINS = [
  'http://localhost:3000',
  'http://localhost'
];

const METHODS = 'GET,POST,PUT,DELETE,PATCH,OPTIONS';
const ALLOWED_HEADERS_LIST = ['Content-Type', 'X-CSRF-Token', 'X-Requested-With'];
const ALLOWED_HEADERS = ALLOWED_HEADERS_LIST.join(',');

const fromEnv = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const baseOrigins = fromEnv.length > 0 ? fromEnv : FALLBACK_ORIGINS;
const allowedOrigins = new Set([...baseOrigins, ...REQUIRED_ORIGINS]);

const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  if (!origin) {
    return next();
  }

  if (!allowedOrigins.has(origin)) {
    console.warn(`[CORS] Origem não permitida: ${origin}`);
    return res.status(403).json({ success: false, error: `Origem não permitida: ${origin}` });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Vary', 'Origin');

  return next();
};

corsMiddleware.ALLOWED_METHODS = METHODS;
corsMiddleware.ALLOWED_HEADERS = ALLOWED_HEADERS;
corsMiddleware.ALLOWED_HEADERS_LIST = ALLOWED_HEADERS_LIST;

module.exports = corsMiddleware;
