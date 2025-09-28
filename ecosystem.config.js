// ecosystem.config.js
// PM2: perfil de desenvolvimento (SQLite) e produção (PostgreSQL).
// Use: pm2 start ecosystem.config.js --env production   (ou --env development)

module.exports = {
  apps: [
    {
      name: "late",
      script: "server.js",
      instances: 1,
      autorestart: true,
      watch: false,
      time: true,

      // Ambiente padrão: desenvolvimento (SQLite)
      env: {
        NODE_ENV: "development",
        HOST: "127.0.0.1",
        PORT: 3000,
        TRUST_PROXY: 0,

        // Sessão (dev)
        SESSION_SECRET: "dev_apenas_teste_mude_isto",

        // Banco (SQLite)
        DB_DRIVER: "sqlite",
        DB_PATH: "./data/recados.db",

        // CORS opcional em dev:
        // CORS_ORIGINS: "http://localhost:3000"
      },

      // Ambiente de produção: PostgreSQL
      env_production: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",   // bind local atrás do NGINX
        PORT: 3000,
        TRUST_PROXY: 1,

        // Sessão (PRODUÇÃO) — troque por uma chave forte!
        SESSION_SECRET: "SUBSTITUA_POR_UMA_CHAVE_FORTE",

        // Banco (PostgreSQL)
        DB_DRIVER: "pg",
        PGHOST: "127.0.0.1",
        PGPORT: 5432,
        PGUSER: "late_app",
        PGPASSWORD: "LATE@123",
        PGDATABASE: "late_prod",
        PG_SSL: "false",

        // CORS — ajuste conforme seu domínio público
        // Ex.: "https://late.miahchat.com,http://localhost:3000"
        // CORS_ORIGINS: "https://late.miahchat.com"
      }
    }
  ]
};
