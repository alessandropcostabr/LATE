const MessageModel = require('../models/message');
const UserSectorModel = require('../models/userSector');
const UserModel = require('../models/user');
const { evaluateAccess, getClientIp, getClientIps } = require('../utils/ipAccess');
const { logEvent: logAuditEvent } = require('../utils/auditLogger');

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

const CRM_PERMISSION_SETS = {
  reader: ['crm:read'],
  operator: ['crm:read', 'crm:create', 'crm:update'],
  supervisor: ['crm:read', 'crm:create', 'crm:update'],
  admin: ['crm:read', 'crm:create', 'crm:update', 'crm:delete'],
};

const ROLE_PERMISSIONS = {
  reader: new Set(['read', ...CRM_PERMISSION_SETS.reader]),
  operator: new Set(['read', 'create', ...CRM_PERMISSION_SETS.operator]),
  supervisor: new Set(['read', 'create', 'update', ...CRM_PERMISSION_SETS.supervisor]),
  admin: new Set(['read', 'create', 'update', 'delete', ...CRM_PERMISSION_SETS.admin]),
};

function isApiRequest(req) {
  return typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/api');
}

function normalizeRoleSlug(role) {
  const value = typeof role === 'object' && role !== null ? role.role : role;
  const key = String(value || '').trim().toLowerCase();
  return ROLE_ALIASES[key] || ROLE_ALIASES[key.replace(/s$/i, '')] || 'reader';
}

function getRolePermissions(role) {
  const slug = normalizeRoleSlug(role);
  return {
    slug,
    permissions: ROLE_PERMISSIONS[slug] || ROLE_PERMISSIONS.reader,
  };
}

function respondUnauthorized(req, res) {
  if (isApiRequest(req)) {
    return res.status(401).json({ success: false, error: 'Não autenticado' });
  }
  return res.redirect('/login');
}

function respondForbidden(req, res) {
  if (isApiRequest(req)) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }
  return res.status(403).render('403', { title: 'Acesso negado' });
}

function getSessionCookieName() {
  return (process.env.NODE_ENV || '').trim() === 'production' ? 'late.sess' : 'late.dev.sess';
}

async function destroySessionAndRespond(req, res, options = {}) {
  const cookieName = getSessionCookieName();

  await new Promise((resolve) => {
    if (req.session && typeof req.session.destroy === 'function') {
      req.session.destroy(() => resolve());
    } else {
      resolve();
    }
  });

  if (typeof res.clearCookie === 'function') {
    res.clearCookie(cookieName);
  }

  if (isApiRequest(req)) {
    const statusCode = options.statusCode || 401;
    const message = options.message || 'Sessão expirada. Faça login novamente.';
    return res.status(statusCode).json({ success: false, error: message });
  }

  const redirectError = options.redirectError || 'session_invalidada';
  return res.redirect(`/login?error=${encodeURIComponent(redirectError)}`);
}

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return respondUnauthorized(req, res);
  }

  try {
    const clientIp = getClientIp(req);
    req.clientIp = clientIp;
    if (!req.clientIps || !req.clientIps.length) {
      req.clientIps = getClientIps(req);
    }

    const sessionUserId = Number(req.session.user.id);
    if (!Number.isInteger(sessionUserId) || sessionUserId <= 0) {
      return destroySessionAndRespond(req, res);
    }

    const user = await UserModel.findById(sessionUserId);
    if (!user || user.is_active !== true) {
      console.warn('[auth] sessão invalidada: usuário inexistente ou inativo', { userId: sessionUserId });
      return destroySessionAndRespond(req, res);
    }

    const dbVersion = Number(user.session_version || 1);
    const storedVersion = Number(req.session.sessionVersion || req.session.user.sessionVersion || 0);

    if (storedVersion === 0) {
      req.session.sessionVersion = dbVersion;
    } else if (storedVersion !== dbVersion) {
      console.warn('[auth] sessão invalidada por versão divergente', {
        userId: sessionUserId,
        storedVersion,
        dbVersion,
      });
      return destroySessionAndRespond(req, res);
    }

    const accessEvaluation = evaluateAccess({
      ip: clientIp,
      user,
    });
    req.accessScope = accessEvaluation.scope;
    req.accessEvaluation = accessEvaluation;

    if (!accessEvaluation.allowed) {
      console.warn('[auth] sessão bloqueada por política de acesso', {
        userId: sessionUserId,
        reason: accessEvaluation.reason,
        ip: clientIp,
      });
      try {
        await logAuditEvent('user.session_denied_offsite', {
          entityType: 'user',
          entityId: sessionUserId,
          actorUserId: sessionUserId,
          metadata: {
            reason: accessEvaluation.reason,
            ip: clientIp,
          },
        });
      } catch (logErr) {
        console.warn('[auth] falha ao registrar audit de sessão bloqueada', logErr);
      }
      return destroySessionAndRespond(req, res, {
        statusCode: 403,
        message: accessEvaluation.message || 'Acesso bloqueado por restrição de segurança.',
        redirectError: 'restricao_acesso',
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      viewScope: user.view_scope,
      access_restrictions: user.access_restrictions,
      sessionVersion: dbVersion,
    };

    req.userRoleSlug = normalizeRoleSlug(user.role);
    return next();
  } catch (err) {
    console.error('[auth] erro ao validar sessão:', err);
    if (isApiRequest(req)) {
      return res.status(500).json({ success: false, error: 'Erro ao validar sessão.' });
    }
    return res.status(500).render('500', { title: 'Erro interno' });
  }
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

function resolvePermissionKey(action, resource) {
  if (!action) return '';
  const base = String(action).trim().toLowerCase();
  if (!base) return '';
  if (base.includes(':')) return base;
  if (resource) {
    const scope = String(resource).trim().toLowerCase();
    return scope ? `${scope}:${base}` : base;
  }
  return base;
}

function requirePermission(action, resource) {
  return function (req, res, next) {
    if (!req.session || !req.session.user) {
      return respondUnauthorized(req, res);
    }

    const { slug: roleSlug, permissions } = getRolePermissions(req.userRoleSlug || req.session.user.role);
    const allowed = permissions;
    const permissionKey = resolvePermissionKey(action, resource);

    if (!permissionKey || !allowed.has(permissionKey)) {
      return respondForbidden(req, res);
    }

    req.userRoleSlug = roleSlug;
    return next();
  };
}

async function requireMessageUpdatePermission(req, res, next) {
  if (!req.session || !req.session.user) {
    return respondUnauthorized(req, res);
  }

  const { slug: roleSlug, permissions } = getRolePermissions(req.userRoleSlug || req.session.user.role);

  if (permissions.has('update')) {
    req.userRoleSlug = roleSlug;
    return next();
  }

  if (roleSlug !== 'operator') {
    return respondForbidden(req, res);
  }

  const messageId = Number(req.params?.id);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return respondForbidden(req, res);
  }

  try {
    const message = await MessageModel.findById(messageId);
    if (!message) {
      if (isApiRequest(req)) {
        return res.status(404).json({ success: false, error: 'Contato não encontrado' });
      }
      return res.status(404).render('404', { title: 'Contato não encontrado' });
    }

    const sessionUserId = Number(req.session.user.id);
    const isOwner = Number.isInteger(sessionUserId) && sessionUserId > 0 && message.created_by === sessionUserId;
    const isRecipient = Number.isInteger(sessionUserId) && sessionUserId > 0 && message.recipient_user_id === sessionUserId;
    const isSectorRecipient = Number.isInteger(sessionUserId) &&
      sessionUserId > 0 &&
      Number.isInteger(message.recipient_sector_id) &&
      await UserSectorModel.isUserInSector(sessionUserId, message.recipient_sector_id);

    if (isOwner || isRecipient || isSectorRecipient) {
      req.userRoleSlug = roleSlug;
      req.messageAccess = {
        isOwner,
        isRecipient: isRecipient || isSectorRecipient,
        isSectorRecipient,
        messageId,
      };
      return next();
    }

    return respondForbidden(req, res);
  } catch (err) {
    console.error('[auth] erro ao validar atualização de contato:', err);
    if (isApiRequest(req)) {
      return res.status(500).json({ success: false, error: 'Falha ao validar permissão' });
    }
    return res.status(500).render('500', { title: 'Erro interno' });
  }
}

function hasPermission(role, action, resource) {
  const { permissions } = getRolePermissions(role);
  const permissionKey = resolvePermissionKey(action, resource);
  if (!permissionKey) return false;
  return permissions.has(permissionKey);
}

module.exports = {
  requireAuth,
  requireRole,
  requirePermission,
  requireMessageUpdatePermission,
  normalizeRoleSlug,
  hasPermission,
};
