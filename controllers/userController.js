const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

exports.list = (req, res) => {
  const users = UserModel.findAll();
  res.json({ success: true, data: users });
};

exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  const { username, password, role } = req.body;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const user = UserModel.create({ username, password: hash, role });
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
