// middleware/cors.js
const cors = require('cors');

// Lê CORS_ORIGINS da env (separadas por vírgula) ou usa defaults para DEV
const fromEnv = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const defaultOrigins = fromEnv.length > 0
  ? fromEnv
  : ['http://localhost:3000', 'http://localhost'];

// Opções de CORS com guarda para requests sem Origin (curl, devtools, health, etc.)
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // sem Origin → permite (curl/localhost)
    const allowed = defaultOrigins.includes(origin);
    return cb(allowed ? null : new Error(`Origem não permitida pelo CORS: ${origin}`), allowed);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','X-CSRF-Token','X-Requested-With'],
};

// Exporta o middleware configurado
module.exports = cors(corsOptions);
