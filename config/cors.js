const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://seu-dominio.com',
  'https://late.miahchat.com'
];

// Aceita lista separada por vírgula ou espaço nas variáveis de ambiente
const originsEnv = process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '';
const envOrigins = originsEnv
  .split(/[\s,]+/)
  .map(o => o.trim())
  .filter(Boolean);

// Garante que os domínios padrão estejam sempre permitidos
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

module.exports = { allowedOrigins };
