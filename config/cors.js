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

// Permite habilitar qualquer origem usando "*" nas variáveis de ambiente
const allowAll = envOrigins.includes('*');

// Usa domínios definidos via ambiente quando houver; caso contrário mantém os padrões
const allowedOrigins = allowAll
  ? []
  : Array.from(new Set(envOrigins.length > 0 ? envOrigins : defaultOrigins));

module.exports = { allowedOrigins, allowAll };
