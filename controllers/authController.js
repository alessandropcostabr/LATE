// controllers/authController.js

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

const ALLOWED_ROLES = ['ADMIN', 'OPERADOR'];

exports.showLogin = (req, res) => {
  res.render('login', {
    title: 'Login',
    csrfToken: req.csrfToken(),
    scripts: ['/js/login.js'],
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
      errors: errors.array(),
    });
  }

  const { password } = req.body;
  const email = req.body.email.trim().toLowerCase();
  const user = UserModel.findByEmail(email);
  if (!user || !user.is_active) {
    const errorMsg = 'Usuário não encontrado ou inativo';
    if (req.accepts('json')) {
      return res.status(401).json({ error: errorMsg });
    }
    return res.status(401).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      error: errorMsg,
    });
  }

  try {
    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) {
      const errorMsg = 'Senha incorreta';
      if (req.accepts('json')) {
        return res.status(401).json({ error: errorMsg });
      }
      return res.status(401).render('login', {
        title: 'Login',
        csrfToken: req.csrfToken(),
        error: errorMsg,
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
      error: 'Erro interno',
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
    selectedRole: undefined,
    name: '',
    email: '',
  });
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  const { name, email, password, role: requestedRole } = req.body;
  const normalizedEmail = email.trim().toLowerCase();
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
      selectedRole: role,
      name,
      email,
    });
  }

  try {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    await UserModel.create({ name, email: normalizedEmail, password_hash: hash, role });
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
        selectedRole: role,
        name,
        email,
      });
    }
    console.error('Erro ao registrar usuário:', err);
    return res.status(500).render('register', {
      title: 'Registrar',
      csrfToken: req.csrfToken(),
      error: 'Erro interno',
      roles,
      selectedRole: role,
      name,
      email,
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
