// ecosystem.config.example.js
// Exemplo **sem segredos**. Copie para `ecosystem.config.js` no servidor.
// Comentários em pt-BR; identificadores em inglês.
// Regras do projeto: variáveis sensíveis ficam no ambiente (.env/.env.prod) ou no PM2, nunca no Git.

module.exports = {
  apps: [
    // =========================
    // Produção (1.0 / 2.0 quando for pra main)
    // =========================
    {
      name: "late",
      script: "server.js",
      instances: 1,              // mantenha 1 até estabilizar; depois cluster
      exec_mode: "fork",         // mude para "cluster" quando estiver estável
      autorestart: true,
      watch: false,
      max_memory_restart: "350M",
      time: true,

      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 3000,
        TRUST_PROXY: 1,           // atrás de proxy (Cloudflare/Nginx)
        // CORS da produção (ajuste o domínio público):
        CORS_ORIGINS: "https://late.miahchat.com",
        // Segredos e PG_* devem vir de .env.prod (ou variáveis do PM2), não coloque aqui.
      }
    },

    // =========================
    // Desenvolvimento (DEV)
    // =========================
    {
      name: "late-dev",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "350M",
      time: true,

      env: {
        NODE_ENV: "development",
        HOST: "127.0.0.1",
        PORT: 3001,
        TRUST_PROXY: 0,
        // Para testes de UI (3000) falando com API (3001), libere ambas as origens:
        CORS_ORIGINS: "http://localhost:3000 http://localhost:3001",
        // Demais segredos e PG_* vêm do .env (DEV)
      }
    }
  ]
};
