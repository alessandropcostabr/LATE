// routes/api.js
// Rotas de API em inglês (payloads/keys) com mensagens ao usuário em pt-BR.

const express = require('express');
const router = express.Router();

const messageController = require('../controllers/messageController');
const userController = require('../controllers/userController');

const {
  validateCreateMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateQueryMessages,
  validateId,
  handleValidationErrors,
} = require('../middleware/validation');

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
router.get(
  '/messages',
  ...validateQueryMessages,
  handleValidationErrors,
  messageController.list
);

router.get(
  '/messages/:id',
  ...validateId,
  handleValidationErrors,
  messageController.getById
);

router.post(
  '/messages',
  ...validateCreateMessage,
  handleValidationErrors,
  messageController.create
);

router.put(
  '/messages/:id',
  ...validateId,
  ...validateUpdateMessage,
  handleValidationErrors,
  messageController.update
);

router.patch(
  '/messages/:id/status',
  ...validateId,
  ...validateUpdateStatus,
  handleValidationErrors,
  messageController.updateStatus
);

router.delete(
  '/messages/:id',
  ...validateId,
  handleValidationErrors,
  messageController.remove
);

router.get('/messages/stats', messageController.stats);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
router.get('/users', userController.list);
router.post('/users', userController.create);
router.patch('/users/:id/active', userController.setActive);

// ---------------------------------------------------------------------------
// Healthcheck e utilitários
// ---------------------------------------------------------------------------
router.get('/healthz', (_req, res) => res.json({ success: true, data: { ok: true } }));

if (process.env.NODE_ENV === 'development') {
  router.get('/whoami', (req, res) => {
    res.json({ success: true, data: { user: req.session ? req.session.user || null : null } });
  });
}

module.exports = router;
