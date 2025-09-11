module.exports = {
  apps: [{
    name: "late-system",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      DB_PATH: "/home/ubuntu/late/data/recados.db"
    },
    instances: 1,
    autorestart: true,
    watch: false,
    time: true
  }]
};
