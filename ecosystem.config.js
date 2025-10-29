// ecosystem.config.js (desenvolvimento)
// Executa o LATE a partir desta worktree de homologação.
// Ajuste segredos via .env local; não versione dados sensíveis.

module.exports = {
  apps: [
    {
      name: 'late-dev',
      cwd: __dirname,
      script: 'server.js',
      instances: 1, // mantenha 1 até optar por cluster
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '350M',
      time: true,
      env: {
        NODE_ENV: 'development',
        HOST: process.env.HOST || '127.0.0.1',
        PORT: process.env.PORT || 3001,
        TRUST_PROXY: process.env.TRUST_PROXY || 0,
      },
    },
  ],
};
