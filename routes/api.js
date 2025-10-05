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

// --- Guards defensivos: evitam crash se algum middleware vier undefined ---
function ensure(fn, name) {
  if (typeof fn === 'function') return fn;
  console.error(`[router] middleware '${name}' inválido (tipo=${Object.prototype.toString.call(fn)}) — usando no-op`);
  return (req, res, next) => next();
}
function chain(...fns) {
  return fns.map((fn, i) => ensure(fn, `mw#${i + 1}`));
}

// ========== Messages ==========

// Listar (com querystring: limit/offset/status/recipient/start_date/end_date)
router.get(
  '/messages',
  ...chain(validateQueryMessages, handleValidationErrors),
  messageController.list
);

// KPIs de cards (total/pending/in_progress/resolved)
router.get('/messages/stats', ensure(statsController.messagesStats, 'messagesStats'));

// Obter 1
router.get(
  '/messages/:id',
  ...chain(validateId, handleValidationErrors),
  messageController.show
);

// Criar
router.post(
  '/messages',
  ...chain(validateCreateMessage, handleValidationErrors),
  messageController.create
);

// Atualizar
router.put(
  '/messages/:id',
  ...chain(validateId, validateUpdateMessage, handleValidationErrors),
  messageController.update
);

// Atualizar status
router.patch(
  '/messages/:id/status',
  ...chain(validateId, validateUpdateStatus, handleValidationErrors),
  messageController.updateStatus
);

// Remover
router.delete(
  '/messages/:id',
  ...chain(validateId, handleValidationErrors),
  messageController.remove
);

// ========== Stats (Relatórios) ==========
router.get('/stats/by-status',    ensure(statsController.byStatus, 'byStatus'));
router.get('/stats/by-recipient', ensure(statsController.byRecipient, 'byRecipient'));
router.get('/stats/by-month',     ensure(statsController.byMonth, 'byMonth'));

// Export
module.exports = router;

