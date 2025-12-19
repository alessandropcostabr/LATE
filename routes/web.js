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
const notificationController = require('../controllers/notificationController');
const messageViewController = require('../controllers/messageViewController');
const contactController = require('../controllers/contactController');
const crmViewController = require('../controllers/crmViewController');
const crmConfigViewController = require('../controllers/crmConfigViewController');
const crmImportViewController = require('../controllers/crmImportViewController');
const { getClientIp, normalizeAccessRestrictions } = require('../utils/ipAccess');
const messageSendEventController = require('../controllers/messageSendEventController');

const UserModel = require('../models/user');
const SectorModel = require('../models/sector');

const router = express.Router();

const DEFAULT_AUDIT_WINDOW_DAYS = 7;

function formatDateTimeLocal(dateLike) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getAuditInitialFilters() {
  const now = new Date();
  const from = new Date(now.getTime() - DEFAULT_AUDIT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return {
    fromIso: from.toISOString(),
    toIso: now.toISOString(),
    fromInput: formatDateTimeLocal(from),
    toInput: formatDateTimeLocal(now),
  };
}

// ------------------------------ Admin --------------------------------------
// Admin → Usuários (apenas ADMIN)
router.get('/admin/usuarios', requireAuth, requireRole('ADMIN'), (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  return res.render('admin-users', {
    title: 'Admin · Usuários',
    csrfToken,
    user: req.session.user || null,
    scripts: ['/js/admin-users.js'], // JS do painel admin de usuários
  });
});

router.get('/admin/usuarios/novo', requireAuth, requireRole('ADMIN'), (req, res) => {
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

router.get('/admin/usuarios/:id/editar', requireAuth, requireRole('ADMIN'), (req, res) => {
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
router.get('/admin/setores', requireAuth, requireRole('ADMIN'), (req, res) => {
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

router.get('/roadmap', requireAuth, (req, res) => {
  res.render('roadmap', { title: 'Roadmap', user: req.session.user || null });
});

router.get('/chamadas', requireAuth, requirePermission('read'), (req, res) => {
  res.render('call-logs', { title: 'Chamadas', user: req.session.user || null });
});

router.get('/admin/notificacoes', requireAuth, requireRole('ADMIN'), csrfProtection, notificationController.showSettings);
router.post('/admin/notificacoes', requireAuth, requireRole('ADMIN'), csrfProtection, notificationController.updateSettings);

// Redirecionamentos legados (manter compatibilidade)
router.get('/admin', requireAuth, requireRole('ADMIN'), (_req, res) => res.redirect(302, '/admin/usuarios'));
router.get('/admin/users', requireAuth, requireRole('ADMIN'), (_req, res) => res.redirect(301, '/admin/usuarios'));
router.get('/admin/users/new', requireAuth, requireRole('ADMIN'), (_req, res) => res.redirect(301, '/admin/usuarios/novo'));
router.get('/admin/users/:id/edit', requireAuth, requireRole('ADMIN'), (req, res) => res.redirect(301, `/admin/usuarios/${encodeURIComponent(req.params.id)}/editar`));
router.get('/admin/sectors', requireAuth, requireRole('ADMIN'), (_req, res) => res.redirect(301, '/admin/setores'));
router.get('/notificacoes', requireAuth, requireRole('ADMIN'), (_req, res) => res.redirect(301, '/admin/notificacoes'));
router.post('/notificacoes', requireAuth, requireRole('ADMIN'), csrfProtection, (req, res) => res.redirect(307, '/admin/notificacoes'));

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

router.get('/recados', requireAuth, requirePermission('read'), csrfProtection, async (req, res) => {
  try {
    const [activeUsers, sectorsResult] = await Promise.all([
      UserModel.getActiveUsersSelect(),
      SectorModel.list({ status: 'active', limit: 200 })
    ]);

    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
    res.render('recados', {
      title: 'Recados',
      user: req.session.user || null,
      csrfToken,
      destinatariosUsuarios: activeUsers,
      destinatariosSetores: sectorsResult?.data || [],
    });
  } catch (err) {
    console.error('[web] erro ao carregar /recados:', err);
    res.status(500).render('500', { title: 'Erro interno', user: req.session.user || null });
  }
});

router.get('/recados/kanban', requireAuth, requirePermission('read'), csrfProtection, messageViewController.kanbanPage);

router.get('/recados/calendario', requireAuth, requirePermission('read'), csrfProtection, messageViewController.calendarPage);

// CRM páginas
router.get('/crm/config', requireAuth, requirePermission('read'), csrfProtection, crmConfigViewController.configPage);
router.get('/crm/importar', requireAuth, requirePermission('read'), csrfProtection, crmImportViewController.importPage);

router.get('/crm/dashboard', requireAuth, requirePermission('read'), csrfProtection, (req, res) => {
  const csrfToken = req.csrfToken ? req.csrfToken() : null;
  res.render('crm-dashboard', {
    title: 'CRM · Dashboard',
    user: req.session.user || null,
    csrfToken,
    scope: 'me'
  });
});

router.get('/crm/leads', requireAuth, requirePermission('read'), csrfProtection, crmViewController.leadsPage);
router.get('/crm/oportunidades', requireAuth, requirePermission('read'), csrfProtection, crmViewController.opportunitiesPage);
router.get('/crm/opportunities/kanban', requireAuth, requirePermission('read'), csrfProtection, (req, res) => {
  res.render('crm-kanban', { title: 'CRM · Kanban', user: req.session.user || null });
});
router.get('/crm/activities/calendario', requireAuth, requirePermission('read'), csrfProtection, (req, res) => {
  const csrfToken = req.csrfToken ? req.csrfToken() : null;
  res.render('crm-calendar', {
    title: 'CRM · Calendário',
    user: req.session.user || null,
    csrfToken,
    scope: 'me'
  });
});

router.get(
  '/contatos/:sender_phone/historico',
  requireAuth,
  requirePermission('read'),
  csrfProtection,
  contactController.showHistory
);

router.get(
  '/contatos/email/historico',
  requireAuth,
  requirePermission('read'),
  csrfProtection,
  contactController.showHistory
);

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

router.get('/relatorios', requireAuth, requireRole('ADMIN', 'SUPERVISOR'), (_req, res) => res.redirect(302, '/relatorios/estatisticas'));

router.get('/relatorios/estatisticas', requireAuth, requireRole('ADMIN', 'SUPERVISOR'), (req, res) => {
  res.render('relatorios-estatisticas', { title: 'Relatórios · Estatísticas', user: req.session.user || null });
});

router.get('/relatorios/status', requireAuth, requireRole('ADMIN', 'SUPERVISOR'), (req, res) => {
  const clientIp = req.clientIp || getClientIp(req);
  const restrictions = normalizeAccessRestrictions(req.session?.user?.access_restrictions || {});
  const fallbackScope = restrictions.ip.enabled
    ? 'ip_restrito'
    : restrictions.schedule.enabled
      ? 'schedule_restricted'
      : 'unrestricted';
  const scope = req.accessScope || fallbackScope;
  res.render('relatorios-status', {
    title: 'Relatórios · Status Operacional',
    user: req.session.user || null,
    clientIp,
    accessScope: scope,
    accessRestrictions: restrictions,
    scripts: ['/js/status.js'],
  });
});

router.get('/relatorios/auditoria', requireAuth, requireRole('ADMIN', 'SUPERVISOR'), async (req, res) => {
  const auditInitialFilters = getAuditInitialFilters();
  let auditUsers = [];
  try {
    auditUsers = await UserModel.getActiveUsersSelect();
  } catch (err) {
    console.error('[web] falha ao carregar usuários para audit:', err);
  }

  res.render('relatorios-auditoria', {
    title: 'Relatórios · Auditoria',
    user: req.session.user || null,
    auditInitialFilters,
    auditUsers,
    scripts: ['/js/relatorios-auditoria.js'],
  });
});

router.get('/relatorios/exportacoes', requireAuth, requireRole('ADMIN', 'SUPERVISOR'), csrfProtection, (req, res) => {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  const auditInitialFilters = getAuditInitialFilters();
  res.render('relatorios-exportacoes', {
    title: 'Relatórios · Exportações',
    user: req.session.user || null,
    auditInitialFilters,
    csrfToken,
    scripts: ['/js/relatorios-exportacoes.js'],
  });
});

router.get('/relatorios/whatsapp',
  requireAuth,
  requireRole('ADMIN', 'SUPERVISOR'),
  messageSendEventController.renderList
);

// 404 handler para rotas web
router.use((req, res) => {
  res
    .status(404)
    .render('404', { title: 'Página não encontrada', user: req.session.user || null });
});

module.exports = router;
