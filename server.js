// server.js

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
// Compression middleware
const compression = require('compression');

// Importar middlewares e rotas
const dbManager     = require('./config/database');
const corsMiddleware = require('./middleware/cors');
const apiRoutes     = require('./routes/api');
const webRoutes     = require('./routes/web');

// Inicializar aplicação Express
const app  = express();
const PORT = process.env.PORT || 3000;

// Define o caminho do CSS baseado no ambiente
app.locals.cssFile =
  process.env.NODE_ENV === 'production'
    ? '/css/style.min.css'
    : '/css/style.css';

// ─── Configuração de View Engine ─────────────────────────────────────────────
// Configurar EJS para renderização server-side
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Segurança, Limites e Middleware ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:    ["'self'", "https://fonts.gstatic.com"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc:  ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max:     100,
  message: {
    success: false,
    message: 'Muitas requisições. Tente novamente em 15 minutos.'
  }
});
app.use('/api/', limiter);

// Servir assets estáticos e logging
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use(morgan('combined'));
// Enable gzip compression
app.use(compression());
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache-control
app.use((req, res, next) => {
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    // Apply long-term caching for versioned (hashed) assets
    if (req.url.match(/\.[0-9a-fA-F]{8,}\./)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/',     webRoutes);

// ─── Tratamento de Erros ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    error:   process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ─── 404 Handler (ajustado para EJS) ─────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      message: 'Endpoint não encontrado'
    });
  } else {
    res.status(404).render('404');
  }
});

// ─── Inicializar Servidor ────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM. Encerrando servidor...');
  dbManager.close();
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT. Encerrando servidor...');
  dbManager.close();
  server.close(() => process.exit(0));
});

// Captura exceções não tratadas
process.on('uncaughtException', err => {
  console.error('❌ Exceção não capturada:', err);
  dbManager.close();
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  dbManager.close();
  process.exit(1);
});

module.exports = app;
