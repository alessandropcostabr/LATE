import cors from 'cors';

// Use ENV CORS_ORIGINS para múltiplas origens, separadas por vírgula.
const fromEnv = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const defaultOrigins = fromEnv.length > 0
  ? fromEnv
  : [
      'http://localhost:3000', // dev padrão
      'http://localhost',      // fallback
    ];

const corsOptions = {
  origin: function (origin, callback) {
    // Permite ferramentas locais (sem header Origin), ex.: curl/Postman
    if (!origin) return callback(null, true);
    const allowed = defaultOrigins.includes(origin);
    if (allowed) return callback(null, true);
    return callback(new Error(`Origem não permitida pelo CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','X-CSRF-Token','X-Requested-With'],
};

export default cors(corsOptions);
