// routes/web.js
// Rotas Web (EJS). Não alterar layout/estilos; apenas ligar fluxos.

const express = require('express');
const { body } = require('express-validator');
const {
  requireAuth,
  requireRole,
  requirePermission,
  requireMessageUpdatePermission,
} = require('../middleware/auth');
const csrfProtection = require('../middleware/csrf');
const authController = require('../controllers/authController');

const UserModel = require('../models/user');
const SectorModel = require('../models/sector');

const router = express.Router();

// ------------------------------ Admin --------------------------------------
// Admin → Usuários (apenas ADMIN)
router.get('/admin/users', requireAuth, requireRole('ADMIN'), (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  return res.render('admin-users', {
    title: 'Admin · Usuários',
    csrfToken,
    user: req.session.user || null,
    scripts: ['/js/admin-users.js'], // JS do painel admin de usuários
  });
});

router.get('/admin/users/new', requireAuth, requireRole('ADMIN'), (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  return res.render('admin-user-form', {
    title: 'Novo usuário',
    csrfToken,
    user: req.session.user || null,
    mode: 'create',
    userId: null,
    scripts: ['/js/admin-user-form.js'],
  });
});

router.get('/admin/users/:id/edit', requireAuth, requireRole('ADMIN'), (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  return res.render('admin-user-form', {
    title: 'Editar usuário',
    csrfToken,
    user: req.session.user || null,
    mode: 'edit',
    userId: Number(req.params.id) || null,
    scripts: ['/js/admin-user-form.js'],
  });
});

// Admin → Setores (apenas ADMIN)
router.get('/admin/sectors', requireAuth, requireRole('ADMIN'), (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  return res.render('admin-sectors', {
    title: 'Admin · Setores',
    csrfToken,
    user: req.session.user || null,
    scripts: ['/js/admin-sectors.js'], // JS do painel admin de setores
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

router.get('/account/password/recover', csrfProtection, (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  res.render('password-recover', {
    title: 'Recuperar senha',
    csrfToken,
    scripts: ['/js/password-recover.js'],
    user: null,
  });
});

router.get('/account/password/reset', csrfProtection, (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  const token = String(req.query?.token || '');
  res.render('password-reset', {
    title: 'Redefinir senha',
    csrfToken,
    token,
    scripts: ['/js/password-reset.js'],
    user: null,
  });
});

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

router.get('/news', requireAuth, (req, res) => {
  res.render('news', { title: 'Novidades', user: req.session.user || null });
});

router.get('/help', requireAuth, (req, res) => {
  res.render('help', { title: 'Central de Ajuda', user: req.session.user || null });
});

router.get('/manual-operacional', requireAuth, (req, res) => {
  res.render('manual-operacional', {
    title: 'Manual Operacional',
    user: req.session.user || null,
  });
});

router.get('/account/password', requireAuth, csrfProtection, (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  res.render('account-password', {
    title: 'Trocar senha',
    user: req.session.user || null,
    csrfToken,
    scripts: ['/js/account-password.js'],
  });
});

router.get('/recados', requireAuth, requirePermission('read'), csrfProtection, (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  res.render('recados', {
    title: 'Recados',
    user: req.session.user || null,
    csrfToken,
  });
});

router.get('/novo-recado', requireAuth, requirePermission('create'), csrfProtection, async (req, res) => {
  try {
    const [activeUsers, sectorsResult] = await Promise.all([
      UserModel.getActiveUsersSelect(),
      SectorModel.list({ status: 'active', limit: 200 })
    ]);
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
    res.render('novo-recado', {
      title: 'Novo Recado',
      user: req.session.user || null,
      csrfToken,
      activeUsers,
      activeSectors: sectorsResult?.data || [],
    });
  } catch (err) {
    console.error('[web] erro ao carregar /novo-recado:', err);
    res.status(500).render('500', { title: 'Erro interno', user: req.session.user || null });
  }
});

router.get('/editar-recado/:id', requireAuth, requireMessageUpdatePermission, csrfProtection, async (req, res) => {
  try {
    const [activeUsers, sectorsResult] = await Promise.all([
      UserModel.getActiveUsersSelect(),
      SectorModel.list({ status: 'active', limit: 200 })
    ]);
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
    res.render('editar-recado', {
      title: 'Editar Recado',
      id: req.params.id,
      user: req.session.user || null,
      csrfToken,
      activeUsers,
      activeSectors: sectorsResult?.data || [],
    });
  } catch (err) {
    console.error('[web] erro ao carregar /editar-recado:', err);
    res.status(500).render('500', { title: 'Erro interno', user: req.session.user || null });
  }
});

router.get('/visualizar-recado/:id', requireAuth, requirePermission('read'), csrfProtection, async (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;

  let activeUsers = [];
  let activeSectors = [];

  if (res.locals.permissions?.updateMessages) {
    try {
      const [users, sectors] = await Promise.all([
        UserModel.getActiveUsersSelect(),
        SectorModel.list({ status: 'active', limit: 200 }),
      ]);
      activeUsers = users || [];
      activeSectors = sectors?.data || [];
    } catch (err) {
      console.error('[web] erro ao preparar encaminhamento em /visualizar-recado:', err);
    }
  }

  res.render('visualizar-recado', {
    title: 'Visualizar Recado',
    id: req.params.id,
    user: req.session.user || null,
    csrfToken,
    activeUsers,
    activeSectors,
  });
});

// Mantém compatibilidade com links antigos
router.get('/recados/:id', requireAuth, requirePermission('read'), (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) {
    return res.status(404).render('404', { title: 'Página não encontrada', user: req.session.user || null });
  }
  return res.redirect(302, `/visualizar-recado/${encodeURIComponent(id)}`);
});

router.get('/relatorios', requireAuth, requireRole('ADMIN', 'SUPERVISOR'), (req, res) => {
  res.render('relatorios', { title: 'Relatórios', user: req.session.user || null });
});

// 404 handler para rotas web
router.use((req, res) => {
  res
    .status(404)
    .render('404', { title: 'Página não encontrada', user: req.session.user || null });
});

module.exports = router;
