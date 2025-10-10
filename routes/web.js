// routes/web.js
// Rotas Web (EJS). Não alterar layout/estilos; apenas ligar fluxos.

const express = require('express');
const { body } = require('express-validator');
const { requireAuth, requireRole, requirePermission } = require('../middleware/auth');
const csrfProtection = require('../middleware/csrf');
const authController = require('../controllers/authController');

const MessageModel = require('../models/message'); // para /recados/:id
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

router.get('/account/password', requireAuth, csrfProtection, (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  res.render('account-password', {
    title: 'Trocar senha',
    user: req.session.user || null,
    csrfToken,
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

router.get('/editar-recado/:id', requireAuth, requirePermission('update'), csrfProtection, async (req, res) => {
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

router.get('/visualizar-recado/:id', requireAuth, requirePermission('read'), csrfProtection, (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  res.render('visualizar-recado', {
    title: 'Visualizar Recado',
    id: req.params.id,
    user: req.session.user || null,
    csrfToken,
  });
});

// Atende também /recados/:id (o front chama este caminho)
router.get('/recados/:id', requireAuth, requirePermission('read'), csrfProtection, async (req, res) => {
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
      user: req.session.user || null,
      csrfToken: typeof req.csrfToken === 'function' ? req.csrfToken() : undefined,
    });
  } catch (e) {
    console.error('[web] erro ao carregar recado:', e);
    return res.status(500).render('500', { title: 'Erro interno', user: req.session.user || null });
  }
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
