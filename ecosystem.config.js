// ecosystem.config.js
// LATE — execução em **um único ambiente**, por enquanto.
// Este arquivo assume que o app está atrás do *Cloudflare (proxy/túnel)* e, portanto, usa TRUST_PROXY=1.
//
// Regras do projeto:
// - Comentários em pt-BR; identificadores em inglês.
// - Banco: PostgreSQL via env `PG_*`.
// - Segurança padrão: sem atalhos de login em produção (AUTH_TEST_MODE=0, DISABLE_CSRF_LOGIN=0).

module.exports = {
  apps: [
    {
      name: "late",
      script: "server.js",
      instances: 1,              // mantenha 1 até estabilizar
      exec_mode: "fork",         // mude para "cluster" quando estiver estável
      autorestart: true,
      watch: false,              // não usar watch em servidor
      max_memory_restart: "350M",
      time: true,

      // Ambiente único (produz cookie `secure: 'auto'` e respeita X-Forwarded-* do Cloudflare)
      env: {
        DB_DRIVER: "pg",
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: 3000,

        // Cloudflare proxy/túnel ativo
        TRUST_PROXY: 1,

        // Sessões — troque por uma chave forte e única (32+ chars)
        SESSION_SECRET: "0b9ba50e4a2a7efb6525cd2db22d49dd0b7d9be9be9f04ce4fd0c224bde30bf38a118ab82bd3c5dbddc344cff9f5826c",

        // Banco: PostgreSQL
        PG_HOST: "127.0.0.1",
        PG_PORT: "5432",
        PG_USER: "late_app",
        PG_PASSWORD: "LATE@123",
        PG_DATABASE: "late_prod",

        // SSL desligado localmente; use "1" se o provedor exigir (ex.: RDS com SSL)
        PG_SSL: "0",

        // Proteções ativas — não usar “atalhos” em produção
        AUTH_TEST_MODE: "0",
        DISABLE_CSRF_LOGIN: "0",

        // CORS: defina o domínio público quando for liberar acesso externo
        CORS_ORIGINS: "https://late.miahchat.com"
      }
    }
  ]
};
