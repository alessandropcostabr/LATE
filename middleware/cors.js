const cors = require('cors');

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requisições sem origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // Permitir qualquer origin em desenvolvimento
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        // Em produção, você pode especificar domínios específicos
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:8080',
            'https://seu-dominio.com'
        ];
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

module.exports = cors(corsOptions);

