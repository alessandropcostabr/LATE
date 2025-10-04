// routes/api.js
// Rotas de API em inglês (keys) com mensagens/valores em pt-BR.
// Comentários em pt-BR; identificadores em inglês.

const express = require('express');
const router = express.Router();

const messageController = require('../controllers/messageController');
const userController = require('../controllers/userController');
const database = require('../config/database'); // usado no /health/db
const csrfProtection = require('../middleware/csrf');

const {
  validateCreateMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateQueryMessages,
  validateId,
  handleValidationErrors,
} = require('../middleware/validation');

/**
 * IMPORTANTE SOBRE PATHS:
 * Este router é montado em server.js com app.use('/api', router).
 * Logo, aqui dentro os caminhos NÃO devem começar com /api.
 */

/* ----------------------------------------
 * Estatísticas para dashboard/relatórios
 * (colocadas ANTES das rotas com :id para evitar colisão)
/* --------------------------------------*/
router.get('/messages/stats', messageController.stats);
router.get('/stats/by-status', messageController.statsByStatus);
router.get('/stats/by-recipient', messageController.statsByRecipient);
router.get('/stats/by-month', messageController.statsByMonth);

/* ---------------------------------------------------------------------------
 * Messages (CRUD)
 * -------------------------------------------------------------------------*/
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

/* ---------------------------------------------------------------------------
 * Users
 * -------------------------------------------------------------------------*/
router.get('/users', userController.list);
router.post('/users', userController.create);
router.patch('/users/:id/active', userController.setActive);

/* ---------------------------------------------------------------------------
 * Healthcheck e utilitários
 * -------------------------------------------------------------------------*/
router.get('/healthz', (_req, res) => res.json({ success: true, data: { ok: true } }));

router.get('/csrf', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.json({ success: true, data: { token } });
});

// Saúde do DB: retorna driver ativo e versão
router.get('/health/db', async (_req, res) => {
  try {
    const db = database.db();
    const driver = database.adapter().name; // 'pg' | 'sqlite'

    let version = 'desconhecida';
    if (driver === 'pg') {
      const row = await db.prepare('SELECT version() AS v').get();
      version = row?.v || version;
    } else {
      const row = await db.prepare('SELECT sqlite_version() AS v').get();
      version = row?.v ? `SQLite ${row.v}` : 'SQLite (versão desconhecida)';
    }

    return res.json({ success: true, data: { driver, version } });
  } catch (err) {
    console.error('[health/db] erro:', err);
    return res.status(500).json({ success: false, error: 'Falha ao consultar saúde do banco' });
  }
});

if (process.env.NODE_ENV === 'development') {
  router.get('/whoami', (req, res) => {
    res.json({ success: true, data: { user: req.session ? req.session.user || null : null } });
  });
}

module.exports = router;

