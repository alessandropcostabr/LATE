const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

exports.showLogin = (req, res) => {
  res.render('login', { title: 'Login', csrfToken: req.csrfToken() });
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      errors: errors.array()
    });
  }

  const { email, password } = req.body;
  const user = UserModel.findByEmail(email);
  if (!user || !user.is_active) {
    return res.status(401).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      error: 'Credenciais inválidas'
    });
  }

  try {
    const valid = await argon2.verify(user.password_hash, password, { type: argon2.argon2id });
    if (!valid) {
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
    res.status(500).render('login', {
      title: 'Login',
      csrfToken: req.csrfToken(),
      error: 'Erro interno'
    });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};
