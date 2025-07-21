const cors = require('cors');
const { allowedOrigins } = require('../config/cors');

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requisições sem origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        callback(new Error('Não permitido pelo CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

module.exports = cors(corsOptions);

