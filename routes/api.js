// routes/api.js
// Comentários em pt-BR; identificadores em inglês.

const Router = require('router');
const router = Router();

// Controllers existentes
const messageController = require('../controllers/messageController');
const statsController   = require('../controllers/statsController');
const passwordController = require('../controllers/passwordController');

// Validation (NOMES DEVEM BATER com middleware/validation.js)
const {
  handleValidationErrors,
  validateCreateMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateId,
  validateQueryMessages,
  validatePasswordResetRequest,
  validatePasswordResetSubmit,
  validateAccountPasswordChange
} = require('../middleware/validation');

// Painel ADMIN de Usuários
const { requireAuth, requireRole, requirePermission } = require('../middleware/auth');
const UserController = require('../controllers/userController');
const {
  validateUserCreate,
  validateUserUpdate,
  validateUserStatus,
  validateUserPassword,
  validateIdParam
} = require('../middleware/validation'); // não redeclarar handleValidationErrors

// --------- Admin: Setores ---------
const sectorController = require('../controllers/sectorController');

// --- Helper defensivo para middlewares vindos de fontes diversas ---
function flatFns(...mws) {
  const result = [];
  const warnings = [];

  function pushWarning(message) {
    warnings.push(message);
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

  const fallbackMessages = () => (
    warnings.length
      ? warnings.slice()
      : [
          `[router] Nenhum middleware válido fornecido (origens: ${
            mws.length ? mws.map((_, index) => `arg#${index + 1}`).join(', ') : '<nenhuma>'
          })`
        ]
  );

  const logWarnings = (req, res, next) => {
    fallbackMessages().forEach((message) => console.warn(message));
    next();
  };

  if (result.length === 0) {
    result.push(logWarnings);
  } else if (warnings.length) {
    result.push(logWarnings);
  }

  return result;
}

const csrfProtection = require('../middleware/csrf');

const canReadMessages = [requireAuth, requirePermission('read')];
const canCreateMessages = [requireAuth, requirePermission('create'), csrfProtection];
const canUpdateMessages = [requireAuth, requirePermission('update'), csrfProtection];
const canDeleteMessages = [requireAuth, requirePermission('delete'), csrfProtection];
const canChangeOwnPassword = [requireAuth, csrfProtection];

// CSRF refresh para clientes não autenticados (ex.: tela de login)
router.get('/csrf', csrfProtection, (req, res) => {
  try {
    const token = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    if (!token) {
      return res.status(500).json({ success: false, error: 'Falha ao gerar token CSRF' });
    }
    return res.json({ success: true, data: { token } });
  } catch (err) {
    console.error('[csrf] erro ao gerar token:', err);
    return res.status(500).json({ success: false, error: 'Falha ao gerar token CSRF' });
  }
});

// ========== Messages ==========
router.get(
  '/messages',
  ...flatFns(canReadMessages, validateQueryMessages, handleValidationErrors),
  messageController.list
);

router.get('/messages/stats', ...flatFns(canReadMessages, statsController.messagesStats));

router.get(
  '/messages/:id',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageController.getById
);

router.post(
  '/messages',
  ...flatFns(canCreateMessages, validateCreateMessage, handleValidationErrors),
  messageController.create
);

router.put(
  '/messages/:id',
  ...flatFns(canUpdateMessages, validateId, validateUpdateMessage, handleValidationErrors),
  messageController.update
);

router.patch(
  '/messages/:id/status',
  ...flatFns(canUpdateMessages, validateId, validateUpdateStatus, handleValidationErrors),
  messageController.updateStatus
);

router.delete(
  '/messages/:id',
  ...flatFns(canDeleteMessages, validateId, handleValidationErrors),
  messageController.remove
);

// ========== Account Password ==========
router.post(
  '/account/password',
  ...flatFns(canChangeOwnPassword, validateAccountPasswordChange, handleValidationErrors),
  passwordController.changePassword
);

// ========== Password Recovery ==========
router.post(
  '/password/recover',
  ...flatFns(csrfProtection, validatePasswordResetRequest, handleValidationErrors),
  passwordController.requestReset
);

router.post(
  '/password/reset',
  ...flatFns(csrfProtection, validatePasswordResetSubmit, handleValidationErrors),
  passwordController.resetWithToken
);

// ========== Stats (Relatórios) ==========
router.get('/stats/by-status',    ...flatFns(canReadMessages, statsController.byStatus));
router.get('/stats/by-recipient', ...flatFns(canReadMessages, statsController.byRecipient));
router.get('/stats/by-month',     ...flatFns(canReadMessages, statsController.byMonth));

// ========== Admin - Users ==========
// GET /api/users?role=ADMIN&status=active&q=Fulano
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

router.put('/users/:id/status',
  requireRole('ADMIN'),
  validateIdParam,
  validateUserStatus,
  handleValidationErrors,
  UserController.updateStatus
);

router.put('/users/:id/password',
  requireRole('ADMIN'),
  validateIdParam,
  validateUserPassword,
  handleValidationErrors,
  UserController.resetPassword
);

router.delete('/users/:id',
  requireRole('ADMIN'),
  validateIdParam,
  handleValidationErrors,
  UserController.remove
);

// ========== Admin - Sectors ==========
// GET /api/sectors?status=active&q=Setor
router.get('/sectors',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateList),
  sectorController.list
);

router.post('/sectors',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateCreate),
  sectorController.create
);

router.put('/sectors/:id',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateUpdate),
  sectorController.update
);

router.put('/sectors/:id/toggle',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateToggle),
  sectorController.toggle
);

router.delete('/sectors/:id',
  requireRole('ADMIN'),
  sectorController.remove
);

// ========== Admin - User ↔ Sectors ==========
router.get('/users/:id/sectors',
  requireRole('ADMIN'),
  sectorController.getUserSectors
);

router.put('/users/:id/sectors',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateUserSectors),
  sectorController.setUserSectors
);

// Export
module.exports = router;
