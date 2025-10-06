// routes/api.js
// Comentários em pt-BR; identificadores em inglês.

const Router = require('router');
const router = Router();

// Controllers
const messageController = require('../controllers/messageController');
const statsController   = require('../controllers/statsController');

// Validation (NOMES DEVEM BATER com middleware/validation.js)
const {
  handleValidationErrors,
  validateCreateMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateId,
  validateQueryMessages
} = require('../middleware/validation');

// Painel ADMIN de Usuarios
const { requireRole } = require('../middleware/auth');
const UserController = require('../controllers/userController');
const {
  validateUserCreate,
  validateUserUpdate,
  validateIdParam
} = require('../middleware/validation'); // <- não redeclara handleValidationErrors

// Admin - Users (somente ADMIN)
router.get('/users',
  requireRole('ADMIN'),
  UserController.list
);

router.get('/users/:id',
  requireRole('ADMIN'),
  validateIdParam,
  handleValidationErrors,
  UserController.getById
);

router.post('/users',
  requireRole('ADMIN'),
  validateUserCreate,
  handleValidationErrors,
  UserController.create
);

router.put('/users/:id',
  requireRole('ADMIN'),
  validateIdParam,
  validateUserUpdate,
  handleValidationErrors,
  UserController.update
);

router.patch('/users/:id/active',
  requireRole('ADMIN'),
  validateIdParam,
  handleValidationErrors,
  UserController.setActive
);

router.patch('/users/:id/password',
  requireRole('ADMIN'),
  validateIdParam,
  handleValidationErrors,
  UserController.resetPassword
);

router.delete('/users/:id',
  requireRole('ADMIN'),
  validateIdParam,
  handleValidationErrors,
  UserController.remove
);

// --- Helper defensivo para middlewares vindos de fontes diversas ---
function flatFns(...mws) {
  const result = [];
  const warnings = [];

  function pushWarning(message) {
    warnings.push(message);
    console.warn(message);
  }

  function visit(node, path) {
    const location = path || '<root>';

    if (node == null) {
      pushWarning(`[router] Middleware ausente em ${location} (valor=${node})`);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((child, index) => visit(child, path ? `${path}[${index}]` : `[${index}]`));
      return;
    }

    if (typeof node === 'function') {
      result.push(node);
      return;
    }

    const type = Object.prototype.toString.call(node);
    pushWarning(`[router] Ignorando middleware inválido em ${location} (tipo=${type})`);
  }

  mws.forEach((mw, index) => visit(mw, `arg#${index + 1}`));

  if (result.length === 0) {
    const fallbackMessages = warnings.length
      ? warnings.slice()
      : [
          `[router] Nenhum middleware válido fornecido (origens: ${
            mws.length ? mws.map((_, index) => `arg#${index + 1}`).join(', ') : '<nenhuma>'
          })`
        ];

    result.push((req, res, next) => {
      fallbackMessages.forEach((message) => console.warn(message));
      next();
    });
  }

  return result;
}

// ========== Messages ==========

// Listar (com querystring: limit/offset/status/recipient/start_date/end_date)
router.get(
  '/messages',
  ...flatFns(validateQueryMessages, handleValidationErrors),
  messageController.list
);

// KPIs de cards (total/pending/in_progress/resolved)
router.get('/messages/stats', ...flatFns(statsController.messagesStats));

// Obter 1
router.get(
  '/messages/:id',
  ...flatFns(validateId, handleValidationErrors),
  messageController.getById
);

// Criar
router.post(
  '/messages',
  ...flatFns(validateCreateMessage, handleValidationErrors),
  messageController.create
);

// Atualizar
router.put(
  '/messages/:id',
  ...flatFns(validateId, validateUpdateMessage, handleValidationErrors),
  messageController.update
);

// Atualizar status
router.patch(
  '/messages/:id/status',
  ...flatFns(validateId, validateUpdateStatus, handleValidationErrors),
  messageController.updateStatus
);

// Remover
router.delete(
  '/messages/:id',
  ...flatFns(validateId, handleValidationErrors),
  messageController.remove
);

// ========== Stats (Relatórios) ==========
router.get('/stats/by-status',    ...flatFns(statsController.byStatus));
router.get('/stats/by-recipient', ...flatFns(statsController.byRecipient));
router.get('/stats/by-month',     ...flatFns(statsController.byMonth));

// Export
module.exports = router;

