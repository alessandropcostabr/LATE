// controllers/authController.js
// Auth: login/logout/register – inputs em inglês, mensagens em pt-BR.

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');
const { evaluateAccess, getClientIp, getClientIps } = require('../utils/ipAccess');
const { logEvent: logAuditEvent } = require('../utils/auditLogger');

const ALLOWED_ROLES = ['ADMIN', 'SUPERVISOR', 'OPERADOR', 'LEITOR'];

function isEmailUniqueViolation(err) {
  if (!err) return false;
  if (err.code === '23505') {
    const message = String(err.message || '').toLowerCase();
    const constraint = String(err.constraint || '').toLowerCase();
    return constraint.includes('users_email') || message.includes('users_email');
  }
  return false;
}

function wantsJson(req) {
  const accept = String(req.headers.accept || '');
  const ctype = String(req.headers['content-type'] || '');
  return accept.includes('application/json') || ctype.includes('application/json') || req.xhr === true;
}

exports.showLogin = (req, res) => {
  const rawError = String(req.query?.error || '').trim();
  let flashError;
  if (rawError === 'session_invalidada') {
    flashError = 'Sua sessão foi encerrada porque outro login foi realizado. Faça login novamente.';
  }

  return res.render('login', {
    title: 'Login',
    csrfToken: req.csrfToken(),
    scripts: ['/js/login.js'],
    error: flashError,
  });
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  const wants = wantsJson(req);
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
  const buildViewData = extra => (csrfToken !== undefined ? { ...extra, csrfToken } : extra);
  if (!errors.isEmpty()) {
    if (wants) {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }
    return res.status(400).render('login', buildViewData({
      title: 'Login',
      errors: errors.array(),
    }));
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();
  const clientIp = getClientIp(req);
  req.clientIp = clientIp;
  if (!req.clientIps || !req.clientIps.length) {
    req.clientIps = getClientIps(req);
  }

  try {
    const user = await UserModel.findByEmail(email);

    const isActive =
      user && (user.is_active === true || user.is_active === 1 || user.is_active === '1');

    if (!user || !isActive) {
      if (wants) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }
      return res.status(401).render('login', buildViewData({
        title: 'Login',
        error: 'Credenciais inválidas',
      }));
    }

    const hash = user.password_hash;
    if (!hash || typeof hash !== 'string' || hash.trim() === '') {
      console.warn('[auth] login falhou', { email, reason: 'password_hash ausente' });
      if (wants) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }
      return res.status(401).render('login', buildViewData({
        title: 'Login',
        error: 'Credenciais inválidas',
      }));
    }

    const ok = await argon2.verify(hash, password);
    if (!ok) {
      if (wants) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }
      return res.status(401).render('login', buildViewData({
        title: 'Login',
        error: 'Credenciais inválidas',
      }));
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      viewScope: user.view_scope || 'all',
      allow_offsite_access: user.allow_offsite_access === true,
    };

    const ipEvaluation = evaluateAccess({
      ip: clientIp,
      allowOffsiteAccess: sessionUser.allow_offsite_access,
    });
    req.accessScope = ipEvaluation.scope;
    req.isOfficeIp = ipEvaluation.isOfficeIp;

    if (!ipEvaluation.allowed) {
      await logAuditEvent('user.login_denied_offsite', {
        entityType: 'user',
        entityId: user.id,
        actorUserId: user.id,
        metadata: {
          reason: ipEvaluation.reason,
          ip: clientIp,
        },
      }).catch(() => {});

      if (wants) {
        return res.status(403).json({ success: false, error: ipEvaluation.message });
      }

      return res.status(403).render('login', buildViewData({
        title: 'Login',
        error: ipEvaluation.message,
      }));
    }

    const sessionVersion = await UserModel.bumpSessionVersion(user.id);
    if (!sessionVersion) {
      console.error('[auth] falha ao incrementar session_version', { userId: user.id });
      if (wants) {
        return res.status(500).json({ success: false, error: 'Erro interno' });
      }
      return res.status(500).render('login', buildViewData({
        title: 'Login',
        error: 'Erro interno',
      }));
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate(err => {
        if (err) return reject(err);

        req.session.user = { ...sessionUser, sessionVersion };
        req.session.sessionVersion = sessionVersion;
        if (req.session.usuario) delete req.session.usuario;

        req.session.save(saveErr => {
          if (saveErr) return reject(saveErr);
          resolve();
        });
      });
    });

    await logAuditEvent('user.login', {
      entityType: 'user',
      entityId: user.id,
      actorUserId: user.id,
      metadata: {
        interface: wants ? 'api' : 'web',
      },
    });

    if (wants) {
      return res.json({ success: true, data: { user: sessionUser } });
    }

    return res.redirect('/');
  } catch (err) {
    console.error('[auth] erro ao autenticar:', err);
    if (wants) {
      return res.status(500).json({ success: false, error: 'Erro interno' });
    }
    return res.status(500).render('login', buildViewData({
      title: 'Login',
      error: 'Erro interno',
    }));
  }
};

exports.showRegister = (req, res) => {
  const roleSession = req.session.user?.role;
  const visible = roleSession === 'ADMIN' ? ALLOWED_ROLES : ['OPERADOR'];

  return res.render('register', {
    title: 'Registrar',
    csrfToken: req.csrfToken(),
    errors: [],
    roles: visible,
    selectedRole: undefined,
    // fields displayed in the form (keep compatibility with view)
    name: '',
    email: '',
  });
};

exports.register = async (req, res) => {
  const errors = validationResult(req);

  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();
  let role = String(req.body.role || 'OPERADOR').trim().toUpperCase();

  const roleSession = req.session.user?.role;
  const visible = roleSession === 'ADMIN' ? ALLOWED_ROLES : ['OPERADOR'];
  if (roleSession !== 'ADMIN') role = 'OPERADOR';
  if (!ALLOWED_ROLES.includes(role)) role = 'OPERADOR';

  if (!errors.isEmpty()) {
    return res.status(400).render('register', {
      title: 'Registrar',
      csrfToken: req.csrfToken(),
      errors: errors.array(),
      roles: visible,
      selectedRole: role,
      name,
      email,
    });
  }

  try {
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });

    await UserModel.create({
      name,
      email,
      password_hash,
      role,
    });

    return res.redirect('/login');
  } catch (err) {
    if (isEmailUniqueViolation(err)) {
      return res.status(409).render('register', {
        title: 'Registrar',
        csrfToken: req.csrfToken(),
        error: 'E-mail já cadastrado',
        roles: visible,
        selectedRole: role,
        name,
        email,
      });
    }

    console.error('[auth] erro ao registrar:', err);
    return res.status(500).render('register', {
      title: 'Registrar',
      csrfToken: req.csrfToken(),
      error: 'Erro interno',
      roles: visible,
      selectedRole: role,
      name,
      email,
    });
  }
};

exports.logout = async (req, res) => {
  const rawId = Number(req.session?.user?.id);
  const actorId = Number.isInteger(rawId) && rawId > 0 ? rawId : null;

  if (req.session?.destroy) {
    await new Promise((resolve) => {
      req.session.destroy((err) => {
        if (err) {
          console.error('[auth] erro ao encerrar sessão durante logout:', err);
        }
        resolve();
      });
    });
  }

  if (actorId) {
    await logAuditEvent('user.logout', {
      entityType: 'user',
      entityId: actorId,
      actorUserId: actorId,
    });
  }

  return res.redirect('/login');
};
