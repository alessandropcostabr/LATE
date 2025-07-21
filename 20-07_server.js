// /home/ubuntu/late/server.js
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar middlewares e rotas
const corsMiddleware = require('./middleware/cors');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');

// Inicializar aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurações de segurança
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Atualizado: removido 'unsafe-inline' para scripts
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:(secure)"],
            connectSrc: ["'self'"], // Atualizado: define conectividade via XHR/fetch
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        }
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,                 // máximo 100 requisições por IP por janela
    message: {
        success: false,
        message: 'Muitas requisições. Tente novamente em 15 minutos.'
    }
});

app.use('/api/', limiter);

// Assets
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));

// Logging
app.use(morgan('combined'));

// CORS
app.use(corsMiddleware);

// Parsing de JSON e URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware para adicionar headers de cache
app.use((req, res, next) => {
    if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
        res.setHeader('Cache-Control', 'no-cache');
    }
    next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api', apiRoutes);

// Rotas web
app.use('/', webRoutes);

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erro interno do servidor',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// Middleware para rotas não encontradas (404)
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({
            success: false,
            message: 'Endpoint não encontrado'
        });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
    }
});

// Inicializar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM. Encerrando servidor...');
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT. Encerrando servidor...');
    server.close(() => process.exit(0));
});

// Tratamento de exceções não capturadas
process.on('uncaughtException', (err) => {
    console.error('❌ Exceção não capturada:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ Promise rejeitada não tratada:', reason);
    process.exit(1);
});

module.exports = app;
