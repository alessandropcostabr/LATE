// routes/api.js
// Comentários em pt-BR; identificadores em inglês.

const Router = require('router');
const router = Router();

// Controllers existentes
const messageController = require('../controllers/messageController');
const statsController   = require('../controllers/statsController');
const passwordController = require('../controllers/passwordController');
const messageLabelController = require('../controllers/messageLabelController');
const messageChecklistController = require('../controllers/messageChecklistController');
const messageCommentController = require('../controllers/messageCommentController');
const messageWatcherController = require('../controllers/messageWatcherController');
const automationController = require('../controllers/automationController');
const healthController = require('../controllers/healthController');
const metaController = require('../controllers/metaController');

// Validation (NOMES DEVEM BATER com middleware/validation.js)
const validation = require('../middleware/validation');
const {
  handleValidationErrors,
  validateCreateMessage,
  validateForwardMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateId,
  validateQueryMessages,
  validatePasswordResetRequest,
  validatePasswordResetSubmit,
  validateAccountPasswordChange,
  validateMessageLabel,
  validateMessageLabelsReplace,
  validateChecklistCreate,
  validateChecklistUpdate,
  validateChecklistItemCreate,
  validateChecklistItemUpdate,
  validateChecklistIdParam,
  validateChecklistItemIdParam,
  validateCommentCreate,
  validateWatcherAdd,
  validateWatcherUserParam,
  validateAutomationCreate,
  validateAutomationUpdate,
  validateAutomationToggle,
  validateAutomationIdParam,
  validateCommentIdParam,
  validateUserCreate,
  validateUserUpdate,
  validateUserStatus,
  validateUserPassword,
  validateIdParam,
} = validation;

// Painel ADMIN de Usuários
const {
  requireAuth,
  requireRole,
  requirePermission,
  requireMessageUpdatePermission,
} = require('../middleware/auth');
const UserController = require('../controllers/userController');

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
const canManageMessageAccess = [requireAuth, requireMessageUpdatePermission, csrfProtection];
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

// Utilitários
router.get('/health', healthController.apiCheck);
router.get('/version', metaController.version);

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
  ...flatFns(
    [requireAuth, csrfProtection],
    validateId,
    validateUpdateMessage,
    handleValidationErrors,
    [requireMessageUpdatePermission]
  ),
  messageController.update
);

router.post(
  '/messages/:id/forward',
  ...flatFns(canUpdateMessages, validateId, validateForwardMessage, handleValidationErrors),
  messageController.forward
);

router.patch(
  '/messages/:id/status',
  ...flatFns(
    [requireAuth, csrfProtection],
    validateId,
    validateUpdateStatus,
    handleValidationErrors,
    [requireMessageUpdatePermission]
  ),
  messageController.updateStatus
);

router.delete(
  '/messages/:id',
  ...flatFns(canDeleteMessages, validateId, handleValidationErrors),
  messageController.remove
);

// ---- Labels ----
router.get(
  '/messages/:id/labels',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageLabelController.list
);

router.post(
  '/messages/:id/labels',
  ...flatFns(canUpdateMessages, validateId, validateMessageLabel, handleValidationErrors),
  messageLabelController.add
);

router.put(
  '/messages/:id/labels',
  ...flatFns(canUpdateMessages, validateId, validateMessageLabelsReplace, handleValidationErrors),
  messageLabelController.replace
);

router.delete(
  '/messages/:id/labels/:label',
  ...flatFns(canUpdateMessages, validateId, handleValidationErrors),
  messageLabelController.remove
);

// ---- Checklists ----
router.get(
  '/messages/:id/checklists',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageChecklistController.list
);

router.post(
  '/messages/:id/checklists',
  ...flatFns(canUpdateMessages, validateId, validateChecklistCreate, handleValidationErrors),
  messageChecklistController.create
);

router.put(
  '/messages/:id/checklists/:checklistId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistUpdate, handleValidationErrors),
  messageChecklistController.update
);

router.delete(
  '/messages/:id/checklists/:checklistId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, handleValidationErrors),
  messageChecklistController.remove
);

router.get(
  '/messages/:id/checklists/:checklistId/items',
  ...flatFns(canReadMessages, validateId, validateChecklistIdParam, handleValidationErrors),
  messageChecklistController.listItems
);

router.post(
  '/messages/:id/checklists/:checklistId/items',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistItemCreate, handleValidationErrors),
  messageChecklistController.createItem
);

router.put(
  '/messages/:id/checklists/:checklistId/items/:itemId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistItemIdParam, validateChecklistItemUpdate, handleValidationErrors),
  messageChecklistController.updateItem
);

router.delete(
  '/messages/:id/checklists/:checklistId/items/:itemId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistItemIdParam, handleValidationErrors),
  messageChecklistController.removeItem
);

// ---- Comentários ----
router.get(
  '/messages/:id/comments',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageCommentController.list
);

router.post(
  '/messages/:id/comments',
  ...flatFns(canManageMessageAccess, validateId, validateCommentCreate, handleValidationErrors),
  messageCommentController.create
);

router.delete(
  '/messages/:id/comments/:commentId',
  ...flatFns(canManageMessageAccess, validateId, validateCommentIdParam, handleValidationErrors),
  messageCommentController.remove
);

// ---- Watchers ----
router.get(
  '/messages/:id/watchers',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageWatcherController.list
);

router.post(
  '/messages/:id/watchers',
  ...flatFns(canUpdateMessages, validateId, validateWatcherAdd, handleValidationErrors),
  messageWatcherController.add
);

router.delete(
  '/messages/:id/watchers/:userId',
  ...flatFns(canUpdateMessages, validateId, validateWatcherUserParam, handleValidationErrors),
  messageWatcherController.remove
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

// ========== Automations ==========
router.get(
  '/automations',
  ...flatFns([requireRole('ADMIN')]),
  automationController.list
);

router.get(
  '/automations/:id',
  ...flatFns([requireRole('ADMIN')], validateAutomationIdParam, handleValidationErrors),
  automationController.get
);

router.get(
  '/automations/:id/logs',
  ...flatFns([requireRole('ADMIN')], validateAutomationIdParam, handleValidationErrors),
  automationController.listLogs
);

router.post(
  '/automations',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationCreate, handleValidationErrors),
  automationController.create
);

router.put(
  '/automations/:id',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationIdParam, validateAutomationUpdate, handleValidationErrors),
  automationController.update
);

router.patch(
  '/automations/:id/toggle',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationIdParam, validateAutomationToggle, handleValidationErrors),
  automationController.toggle
);

router.delete(
  '/automations/:id',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationIdParam, handleValidationErrors),
  automationController.remove
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
