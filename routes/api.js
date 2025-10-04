// routes/api.js
// Rotas de API em inglês (payloads/keys) com mensagens ao usuário em pt-BR.


const express = require('express');
const router = express.Router();

const statsController = require('../controllers/statsController');
const messageController = require('../controllers/messageController');
const userController = require('../controllers/userController');
const database = require('../config/database'); // <— adicionado para health/db
const csrfProtection = require('../middleware/csrf');

const {
  validateCreateMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateQueryMessages,
  validateId,
  handleValidationErrors,
} = require('../middleware/validation');


// ----------------------------------------
// Estatísticas para dashboard/relatórios
// ----------------------------------------

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
  '/messages/:id(\d+)',
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
  '/messages/:id(\d+)',
  ...validateId,
  ...validateUpdateMessage,
  handleValidationErrors,
  messageController.update
);

router.patch(
  '/messages/:id(\d+)/status',
  ...validateId,
  ...validateUpdateStatus,
  handleValidationErrors,
  messageController.updateStatus
);

router.delete(
  '/messages/:id(\d+)',
  ...validateId,
  handleValidationErrors,
  messageController.remove
);


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

router.get('/csrf', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.json({ success: true, data: { token } });
});

// Novo: h  ealth do DB (mostra driver e versão do banco em execução no processo)
router.get('/health/db', async (_req, res) => {
  try {
    const db = database.db();
    const driver = database.adapter().name; // 'pg' | 'sqlite'

    let version = 'desconhecida';
    if (driver === 'pg') {
      // PostgreSQL
      const row = await db.prepare('SELECT version() AS v').get();
      version = row?.v || version;
    } else {
      // SQLite
      const row = await db.prepare('SELECT sqlite_version() AS v').get();
      version = row?.v ? `SQLite ${row.v}` : 'SQLite (versão desconhecida)';
    }

    return res.json({
      success: true,
      data: { driver, version },
    });
  } catch (err) {
    console.error('[health/db] erro:', err);
    return res.status(500).json({
      success: false,
      error: 'Falha ao consultar saúde do banco',
    });
  }
});

if (process.env.NODE_ENV === 'development') {
  router.get('/whoami', (req, res) => {
    res.json({ success: true, data: { user: req.session ? req.session.user || null : null } });
  });
}

module.exports = router;
