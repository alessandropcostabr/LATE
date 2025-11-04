// controllers/authController.js
// Auth: login/logout/register – inputs em inglês, mensagens em pt-BR.

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

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
    };

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

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
