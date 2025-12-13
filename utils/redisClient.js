// utils/redisClient.js
// Singleton para Redis usando ioredis. Retorna null se não configurado ou se falhar.

const Redis = require("ioredis");

let client = null;
let failed = false;

function buildOptionsFromEnv() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  const host = process.env.REDIS_HOST || "127.0.0.1";
  const port = Number(process.env.REDIS_PORT || 6379);
  const password = process.env.REDIS_PASSWORD || null;
  return {
    host,
    port,
    password: password || undefined,
    lazyConnect: true,
  };
}

function getRedis() {
  if (failed) return null;
  if (client) return client;

  const opts = buildOptionsFromEnv();
  try {
    client = new Redis(opts);
    client.on("error", (err) => {
      console.warn("[redis] erro:", err?.message || err);
    });
    return client;
  } catch (err) {
    console.warn("[redis] não inicializado:", err?.message || err);
    failed = true;
    return null;
  }
}

module.exports = { getRedis };
