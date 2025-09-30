// routes/web.js
// Rotas de páginas (EJS). Mantemos CSRF em formulários renderizados e o
// frontend busca o token para submissões assíncronas.

const express = require('express');
const { body } = require('express-validator');
const { requireAuth, requireRole } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrf');
const authController = require('../controllers/authController');

const router = express.Router();

// ------------------------------ Auth ---------------------------------------
// GET /login: protegido para gerar e renderizar token no formulário
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

router.get('/relatorios', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.render('relatorios', { title: 'Relatórios', user: req.session.user || null });
});

// 404 handler para rotas web
router.use((req, res) => {
  res.status(404).render('404', { title: 'Página não encontrada', user: req.session.user || null });
});

module.exports = router;
