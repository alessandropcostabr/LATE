// routes/web.js
// Rotas Web (EJS). Não alterar layout/estilos; apenas ligar fluxos.

const express = require('express');
const { body } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrf');
const authController = require('../controllers/authController');

const MessageModel = require('../models/message'); // para /recados/:id

const router = express.Router();

// Admin → Usuários (apenas ADMIN)
router.get('/admin/users', requireAuth, requireRole('ADMIN'), (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  return res.render('admin-users', {
    title: 'Admin · Usuários',
    csrfToken,
    scripts: ['/js/admin-users.js'], // novo JS do painel admin
  });
});

// ------------------------------ Auth ---------------------------------------
router.get('/login', csrfProtection, authController.showLogin);

router.post(
  '/login',
  csrfProtection,
  body('email').isEmail(),
  body('password').notEmpty(),
  authController.login
);

router.get('/logout', requireAuth, authController.logout);

// --------------------------- Registro de usuários --------------------------
router.get(
  '/register',
  requireAuth,
  requireRole('ADMIN'),
  csrfProtection,
  authController.showRegister
);

router.post(
  '/register',
  requireAuth,
  requireRole('ADMIN'),
  csrfProtection,
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['ADMIN', 'OPERADOR']),
  authController.register
);

// ------------------------------- Páginas ----------------------------------
router.get('/', requireAuth, (req, res) => {
  res.render('index', { title: 'Dashboard', user: req.session.user || null });
});

router.get('/recados', requireAuth, (req, res) => {
  res.render('recados', { title: 'Recados', user: req.session.user || null });
});

router.get('/novo-recado', requireAuth, (req, res) => {
  res.render('novo-recado', { title: 'Novo Recado', user: req.session.user || null });
});

router.get('/editar-recado/:id', requireAuth, (req, res) => {
  res.render('editar-recado', {
    title: 'Editar Recado',
    id: req.params.id,
    user: req.session.user || null
  });
});

router.get('/visualizar-recado/:id', requireAuth, (req, res) => {
  res.render('visualizar-recado', {
    title: 'Visualizar Recado',
    id: req.params.id,
    user: req.session.user || null
  });
});

// Atende também /recados/:id (o front chama este caminho)
router.get('/recados/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(404).render('404', { title: 'Página não encontrada', user: req.session.user || null });

    const recado = await (MessageModel.findById ? MessageModel.findById(id) : MessageModel.getById(id));
    if (!recado) return res.status(404).render('404', { title: 'Página não encontrada', user: req.session.user || null });

    // Renderiza a mesma view de visualização (sem alterar layout)
    return res.render('visualizar-recado', {
      title: 'Visualizar Recado',
      id,
      recado,
      user: req.session.user || null
    });
  } catch (e) {
    console.error('[web] erro ao carregar recado:', e);
    return res.status(500).render('500', { title: 'Erro interno', user: req.session.user || null });
  }
});

router.get('/relatorios', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.render('relatorios', { title: 'Relatórios', user: req.session.user || null });
});

// 404 handler para rotas web
router.use((req, res) => {
  res
    .status(404)
    .render('404', { title: 'Página não encontrada', user: req.session.user || null });
});

module.exports = router;

