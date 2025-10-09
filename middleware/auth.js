const ROLE_ALIASES = {
  admin: 'admin',
  administrador: 'admin',
  supervisor: 'supervisor',
  supervisora: 'supervisor',
  operator: 'operator',
  operador: 'operator',
  operadora: 'operator',
  reader: 'reader',
  leitor: 'reader',
  leitora: 'reader',
};

const ROLE_PERMISSIONS = {
  reader: new Set(['read']),
  operator: new Set(['read', 'create']),
  supervisor: new Set(['read', 'create', 'update']),
  admin: new Set(['read', 'create', 'update', 'delete']),
};

function isApiRequest(req) {
  return typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/api');
}

function normalizeRoleSlug(role) {
  const key = String(role || '').trim().toLowerCase();
  return ROLE_ALIASES[key] || ROLE_ALIASES[key.replace(/s$/i, '')] || 'reader';
}

function respondUnauthorized(req, res) {
  if (isApiRequest(req)) {
    return res.status(401).json({ success: false, error: 'Autenticação necessária' });
  }
  return res.redirect('/login');
}

function respondForbidden(req, res) {
  if (isApiRequest(req)) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }
  return res.status(403).render('403', { title: 'Acesso negado' });
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    req.userRoleSlug = normalizeRoleSlug(req.session.user.role);
    return next();
  }
  return respondUnauthorized(req, res);
}

function requireRole(...roles) {
  const normalizedRoles = roles.map((role) => String(role || '').trim().toUpperCase());
  return function (req, res, next) {
    if (!req.session || !req.session.user) {
      return respondUnauthorized(req, res);
    }
    const sessionRole = String(req.session.user.role || '').trim().toUpperCase();
    if (normalizedRoles.length === 0 || normalizedRoles.includes(sessionRole)) {
      req.userRoleSlug = req.userRoleSlug || normalizeRoleSlug(req.session.user.role);
      return next();
    }
    return respondForbidden(req, res);
  };
}

function requirePermission(action) {
  return function (req, res, next) {
    if (!req.session || !req.session.user) {
      return respondUnauthorized(req, res);
    }

    const roleSlug = req.userRoleSlug || normalizeRoleSlug(req.session.user.role);
    const allowed = ROLE_PERMISSIONS[roleSlug] || ROLE_PERMISSIONS.reader;

    if (!allowed.has(action)) {
      return respondForbidden(req, res);
    }

    req.userRoleSlug = roleSlug;
    return next();
  };
}

module.exports = { requireAuth, requireRole, requirePermission };
