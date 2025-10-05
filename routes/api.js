// routes/api.js
// Comentários em pt-BR; identificadores em inglês.
// Rotas REST (/api/*) — CRUD de messages, estatísticas e health do DB.

const express = require('express');
const router = express.Router();

// Controllers
const messageController = require('../controllers/messageController');
const userController    = require('../controllers/userController'); // opcional

// Handlers de stats com require tardio (evita cache quebrado e garante função)
const statsHandlers = {
  messagesStats: (req, res, next) => {
    try {
      const c = require('../controllers/statsController');
      return (typeof c.messagesStats === 'function')
        ? c.messagesStats(req, res, next)
        : next(new Error('statsController.messagesStats não é função'));
    } catch (e) { return next(e); }
  },
  byStatus: (req, res, next) => {
    try {
      const c = require('../controllers/statsController');
      return (typeof c.byStatus === 'function')
        ? c.byStatus(req, res, next)
        : next(new Error('statsController.byStatus não é função'));
    } catch (e) { return next(e); }
  },
  byRecipient: (req, res, next) => {
    try {
      const c = require('../controllers/statsController');
      return (typeof c.byRecipient === 'function')
        ? c.byRecipient(req, res, next)
        : next(new Error('statsController.byRecipient não é função'));
    } catch (e) { return next(e); }
  },
  byMonth: (req, res, next) => {
    try {
      const c = require('../controllers/statsController');
      return (typeof c.byMonth === 'function')
        ? c.byMonth(req, res, next)
        : next(new Error('statsController.byMonth não é função'));
    } catch (e) { return next(e); }
  }
};

// Infra
const database       = require('../config/database'); // /health/db
const csrfProtection = require('../middleware/csrf');

// Validações
const {
  validateCreateMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateListMessages,
  validateIdParam,
  handleValidation
} = require('../middleware/validation');

/* -------------------------------------------------------------------- *
 * Helpers defensivos para registro de rotas
 * - Achata arrays de middlewares e garante que todo item seja função
 * - Se não for função, registra um middleware que loga erro e chama next(err)
 * -------------------------------------------------------------------- */
function normalizeHandlers(handlers, label) {
  const flat = handlers.flatMap(h => Array.isArray(h) ? h : [h]);
  return flat.map((mw, i) => {
    if (typeof mw === 'function') return mw;
    const type = Object.prototype.toString.call(mw);
    return (req, res, next) => {
      const msg = `[router] ${label}: middleware #${i} inválido (tipo=${type})`;
      console.error(msg);
      next(new Error(msg));
    };
  });
}

function add(method, path, ...handlers) {
  const label = `${method.toUpperCase()} ${path}`;
  const fns = normalizeHandlers(handlers, label);
  router[method](path, ...fns);
}

const GET    = (...args) => add('get',    ...args);
const POST   = (...args) => add('post',   ...args);
const PUT    = (...args) => add('put',    ...args);
const PATCH  = (...args) => add('patch',  ...args);
const DELETE = (...args) => add('delete', ...args);

/* ======================================================================
 * Health do banco
 * ====================================================================*/
GET('/health/db', async (_req, res) => {
  try {
    const row = await database.db().one('SELECT version() AS version');
    return res.json({
      success: true,
      data: {
        driver: database.driver || process.env.DB_DRIVER || 'pg',
        version: row.version
      }
    });
  } catch (err) {
    console.error('[health/db] erro:', err);
    return res.status(500).json({ success: false, error: 'Falha ao consultar saúde do banco' });
  }
});

/* ======================================================================
 * Estatísticas (dashboard/relatórios) — antes de rotas com :id
 * ====================================================================*/
GET('/messages/stats',     statsHandlers.messagesStats);
GET('/stats/by-status',    statsHandlers.byStatus);
GET('/stats/by-recipient', statsHandlers.byRecipient);
GET('/stats/by-month',     statsHandlers.byMonth);

/* ======================================================================
 * Messages (CRUD)
 * ====================================================================*/
GET(
  '/messages',
  validateListMessages,
  handleValidation,
  messageController.list
);

GET(
  '/messages/:id',
  validateIdParam,
  handleValidation,
  messageController.getById
);

POST(
  '/messages',
  csrfProtection,
  validateCreateMessage,
  handleValidation,
  messageController.create
);

PUT(
  '/messages/:id',
  csrfProtection,
  validateIdParam,
  validateUpdateMessage,
  handleValidation,
  messageController.update
);

PATCH(
  '/messages/:id',
  csrfProtection,
  validateIdParam,
  validateUpdateMessage,
  handleValidation,
  messageController.update
);

PATCH(
  '/messages/:id/status',
  csrfProtection,
  validateIdParam,
  validateUpdateStatus,
  handleValidation,
  messageController.updateStatus
);

DELETE(
  '/messages/:id',
  csrfProtection,
  validateIdParam,
  handleValidation,
  messageController.remove
);

/* ======================================================================
 * Users (opcional)
 * ====================================================================*/
if (userController && typeof userController.me === 'function') {
  GET('/users/me', userController.me);
}

module.exports = router;

