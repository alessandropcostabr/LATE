module.exports = {
  apps: [{
    name: "late",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      HOST: "127.0.0.1",  // força bind local
      PORT: 3000,
      DB_PATH: "/home/amah/LATE/data/recados.db" // caminho correto no Mint
    },
    instances: 1,
    autorestart: true,
    watch: false,
    time: true
  }]
};

