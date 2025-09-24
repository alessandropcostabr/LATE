// controllers/authController.js
// Auth: login/logout/register – inputs em inglês, mensagens em pt-BR.

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

const ALLOWED_ROLES = ['ADMIN', 'SUPERVISOR', 'OPERADOR', 'LEITOR'];

exports.showLogin = (req, res) => {
  return res.render('login', {
    title: 'Login',
    csrfToken: req.csrfToken(),
    scripts: ['/js/login.js'],
  });
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.accepts('json')) {
      return res.status(400).json({ success: false, error: 'Dados inválidos' });
    }
    return res.status(400).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      errors: errors.array(),
    });
  }

  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();

  try {
    const user = UserModel.findByEmail(email);

    if (!user || Number(user.is_active) !== 1) {
      if (req.accepts('json')) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }
      return res.status(401).render('login', {
        title: 'Login',
        csrfToken: req.csrfToken(),
        error: 'Credenciais inválidas',
      });
    }

    // password_hash is canonical; keep fallback from any legacy column name if needed.
    const hash = user.password_hash;
    if (!hash || typeof hash !== 'string' || hash.trim() === '') {
      console.warn('[auth] login falhou', { email, reason: 'password_hash ausente' });
      if (req.accepts('json')) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }
      return res.status(401).render('login', {
        title: 'Login',
        csrfToken: req.csrfToken(),
        error: 'Credenciais inválidas',
      });
    }

    const ok = await argon2.verify(hash, password);
    if (!ok) {
      if (req.accepts('json')) {
        return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      }
      return res.status(401).render('login', {
        title: 'Login',
        csrfToken: req.csrfToken(),
        error: 'Credenciais inválidas',
      });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    if (req.session.usuario) delete req.session.usuario;

    return res.redirect('/');
  } catch (err) {
    console.error('[auth] erro ao autenticar:', err);
    if (req.accepts('json')) {
      return res.status(500).json({ success: false, error: 'Erro interno' });
    }
    return res.status(500).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      error: 'Erro interno',
    });
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
    const isEmailUnique =
      err?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (err?.code === 'SQLITE_CONSTRAINT' && String(err?.message || '').includes('users.email'));

    if (isEmailUnique) {
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

