const rateLimit = require('express-rate-limit');

const CRM_WINDOW_MS = Number(process.env.CRM_RATE_WINDOW_MS || 15 * 60 * 1000);
const CRM_MAX = Number(process.env.CRM_RATE_LIMIT || 100);

const CRM_IMPORT_WINDOW_MS = Number(process.env.CRM_IMPORT_RATE_WINDOW_MS || 15 * 60 * 1000);
const CRM_IMPORT_MAX = Number(process.env.CRM_IMPORT_RATE_LIMIT || 5);

const crmLimiter = rateLimit({
  windowMs: CRM_WINDOW_MS,
  max: CRM_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de requisições CRM atingido. Aguarde antes de tentar novamente.' },
  skip: req => req.method === 'OPTIONS',
});

const crmImportLimiter = rateLimit({
  windowMs: CRM_IMPORT_WINDOW_MS,
  max: CRM_IMPORT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de importação CRM atingido. Aguarde antes de tentar novamente.' },
  skip: req => req.method === 'OPTIONS',
});

module.exports = {
  crmLimiter,
  crmImportLimiter,
};
