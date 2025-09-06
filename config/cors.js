const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://seu-dominio.com',
  'https://late.miahchat.com'
];

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : defaultOrigins;

module.exports = { allowedOrigins };
