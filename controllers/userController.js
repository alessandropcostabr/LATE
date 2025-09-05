const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

exports.list = (req, res) => {
  const page  = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const q     = req.query.q || '';
  const result = UserModel.list({ q, page, limit });
  res.json({ success: true, data: result.data, pagination: result.pagination });
};

exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  const { name, email, password, role } = req.body;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const user = UserModel.create({ name, email, password_hash: hash, role });
  res.status(201).json({ success: true, data: user });
};

exports.setActive = (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  const ok = UserModel.setActive(Number(id), active);
  if (!ok) {
    return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
  }
  res.json({ success: true });
};

exports.showRegister = (req, res) => {
  res.render('register', { title: 'Registrar Usuário', csrfToken: req.csrfToken() });
};
