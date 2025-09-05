const express = require('express');
const { body } = require('express-validator');
const csrf = require('csurf');

const { requireAuth, requireRole } = require('../middleware/auth');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const router = express.Router();
const csrfProtection = csrf();

// Autenticação
router.get('/login', csrfProtection, authController.showLogin);
router.post(
  '/login',
  csrfProtection,
  body('username').notEmpty(),
  body('password').notEmpty(),
  authController.login
);

router.get('/logout', requireAuth, authController.logout);

// Registro de usuários (apenas ADMIN)
router.get(
  '/register',
  requireAuth,
  requireRole('ADMIN'),
  csrfProtection,
  userController.showRegister
);

router.post(
  '/register',
  requireAuth,
  requireRole('ADMIN'),
  csrfProtection,
  body('username').notEmpty(),
  body('password').isLength({ min: 6 }),
  body('role').optional().isIn(['ADMIN', 'USER']),
  userController.create
);

// Dashboard
router.get('/', requireAuth, (req, res) => {
  res.render('index', { title: 'Dashboard', user: req.session.user || null });
});

// Lista de recados
router.get('/recados', requireAuth, (req, res) => {
  res.render('recados', { title: 'Recados', user: req.session.user || null });
});

// Novo recado
router.get('/novo-recado', requireAuth, (req, res) => {
  res.render('novo-recado', { title: 'Novo Recado', user: req.session.user || null });
});

// Editar recado
router.get('/editar-recado/:id', requireAuth, (req, res) => {
  res.render('editar-recado', {
      title: 'Editar Recado',
      id: req.params.id,
      user: req.session.user || null
    });
});

// Visualizar recado
router.get('/visualizar-recado/:id', requireAuth, (req, res) => {
  res.render('visualizar-recado', {
      title: 'Visualizar Recado',
      id: req.params.id,
      user: req.session.user || null
    });
});

// Relatórios
router.get('/relatorios', requireAuth, requireRole('ADMIN'), (req, res) => {
  res.render('relatorios', { title: 'Relatórios', user: req.session.user || null });
});

// 404
router.use((req, res) => {
  res.status(404).render('404', { title: 'Página não encontrada', user: req.session.user || null });
});

module.exports = router;
