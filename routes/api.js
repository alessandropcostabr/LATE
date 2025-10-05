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

// --- Helper defensivo para middlewares vindos de fontes diversas ---
function flatFns(...mws) {
  const result = [];

  function visit(node, path) {
    if (!node) return; // ignora falsy sem logar

    if (Array.isArray(node)) {
      node.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }

    if (typeof node === 'function') {
      result.push(node);
      return;
    }

    const type = Object.prototype.toString.call(node);
    const location = path || '<root>';
    console.warn(`[router] Ignorando middleware inválido em ${location} (tipo=${type})`);
  }

  mws.forEach((mw, index) => visit(mw, `arg#${index + 1}`));
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

