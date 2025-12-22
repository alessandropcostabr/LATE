const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedis } = require('../utils/redisClient');

const CRM_WINDOW_MS = Number(process.env.CRM_RATE_WINDOW_MS || 15 * 60 * 1000);
const CRM_MAX = Number(process.env.CRM_RATE_LIMIT || 100);

const CRM_IMPORT_WINDOW_MS = Number(process.env.CRM_IMPORT_RATE_WINDOW_MS || 15 * 60 * 1000);
const CRM_IMPORT_MAX = Number(process.env.CRM_IMPORT_RATE_LIMIT || 5);

const enableRedis = ['1', 'true', 'yes', 'on'].includes(String(process.env.CRM_RATE_LIMIT_REDIS || '').toLowerCase());
let redisStore;
let redisStoreImport;

if (enableRedis) {
  const redis = getRedis();
  if (redis) {
    redisStore = new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rl:crm:',
    });
    redisStoreImport = new RedisStore({
      sendCommand: (...args) => redis.call(...args),
      prefix: 'rl:crm-import:',
    });
  } else {
    console.warn('[rate-limit] Redis indisponível, usando memória para CRM.');
  }
}

const crmLimiter = rateLimit({
  windowMs: CRM_WINDOW_MS,
  max: CRM_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de requisições CRM atingido. Aguarde antes de tentar novamente.' },
  skip: req => req.method === 'OPTIONS',
  store: redisStore,
});

const crmImportLimiter = rateLimit({
  windowMs: CRM_IMPORT_WINDOW_MS,
  max: CRM_IMPORT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de importação CRM atingido. Aguarde antes de tentar novamente.' },
  skip: req => req.method === 'OPTIONS',
  store: redisStoreImport,
});

module.exports = {
  crmLimiter,
  crmImportLimiter,
};
