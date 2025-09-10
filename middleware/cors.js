const cors = require('cors');
const { allowedOrigins, allowAll } = require('../config/cors');

const corsOptions = {
    origin: function (origin, callback) {
        // Permitir requisições sem origin (mobile apps, Postman, etc.)
        if (!origin || allowAll || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

         // Não autoriza CORS para a origem, mas sem quebrar a requisição.
         // O navegador bloqueará o acesso por não receber os headers CORS.
         // Evita 403 em SSR e chamadas disparadas por extensões.
         callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token']
};

module.exports = cors(corsOptions);

