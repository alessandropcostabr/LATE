const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

const ALLOWED_ROLES = ['ADMIN', 'OPERADOR'];

exports.showLogin = (req, res) => {
  res.render('login', {
    title: 'Login',
    csrfToken: req.csrfToken(),
    scripts: [
      '/js/login.js'
    ]
  });
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.accepts('json')) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    return res.status(400).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      errors: errors.array()
    });
  }

  const { email, password } = req.body;
  const user = UserModel.findByEmail(email);
  if (!user || !user.is_active) {
    if (req.accepts('json')) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    return res.status(401).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      error: 'Credenciais inválidas'
    });
  }

  try {
    const valid = await argon2.verify(user.password_hash, password, { type: argon2.argon2id });
    if (!valid) {
      if (req.accepts('json')) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }
      return res.status(401).render('login', {
        title: 'Login',
        csrfToken: req.csrfToken(),
        error: 'Credenciais inválidas'
      });
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.redirect('/');
  } catch (err) {
    console.error('Erro ao verificar senha:', err);
    if (req.accepts('json')) {
      return res.status(500).json({ error: 'Erro interno' });
    }
    res.status(500).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      error: 'Erro interno'
    });
  }
};

exports.showRegister = (req, res) => {
  const roles = req.session.user?.role === 'ADMIN' ? ALLOWED_ROLES : ['OPERADOR'];
  res.render('register', {
    title: 'Registrar',
    csrfToken: req.csrfToken(),
    errors: [],
    roles,
    selectedRole: undefined
  });
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  const { name, email, password, role: requestedRole } = req.body;
  const role =
    req.session.user?.role === 'ADMIN' && ALLOWED_ROLES.includes(requestedRole)
      ? requestedRole
      : 'OPERADOR';
  const roles = req.session.user?.role === 'ADMIN' ? ALLOWED_ROLES : ['OPERADOR'];

  if (!errors.isEmpty()) {
    return res.status(400).render('register', {
      title: 'Registrar',
      csrfToken: req.csrfToken(),
      errors: errors.array(),
      roles,
      selectedRole: role
    });
  }

  try {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await UserModel.create({ name, email, password_hash: hash, role });
    return res.redirect('/login');
  } catch (err) {
    if (
      err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('users.email'))
    ) {
      return res.status(409).render('register', {
        title: 'Registrar',
        csrfToken: req.csrfToken(),
        error: 'E-mail já cadastrado',
        roles,
        selectedRole: role
      });
    }
    console.error('Erro ao registrar usuário:', err);
    return res.status(500).render('register', {
      title: 'Registrar',
      csrfToken: req.csrfToken(),
      error: 'Erro interno',
      roles,
      selectedRole: role
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
