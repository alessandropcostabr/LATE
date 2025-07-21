const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:8080',
  'https://seu-dominio.com'
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : defaultOrigins;

module.exports = { allowedOrigins };
