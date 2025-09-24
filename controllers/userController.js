// controllers/userController.js
// Users API – payloads em inglês e mensagens em pt-BR.

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

// GET /api/users
exports.list = (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 10;
  const q     = String(req.query.q || '');
  const r = UserModel.list({ q, page, limit });
  return res.json({ success: true, data: r.data, pagination: r.pagination });
};

// POST /api/users
exports.create = async (req, res) => {
  const errors = validationResult(req);

  const name     = String(req.body.name || '').trim();
  const email    = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();
  const role     = String(req.body.role || 'OPERADOR').trim().toUpperCase();

  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    const user = UserModel.create({ name, email, password_hash, role });
    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    const isEmailUnique =
      err?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
      (err?.code === 'SQLITE_CONSTRAINT' && String(err?.message || '').includes('users.email'));
    if (isEmailUnique) {
      return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
    }
    console.error('[users] create error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao criar usuário.' });
  }
};

// PATCH /api/users/:id/active
exports.setActive = (req, res) => {
  const id = Number(req.params.id);
  const activeInput = req.body.active;
  const active = activeInput === true || activeInput === 'true' || activeInput === 1 || activeInput === '1';
  const ok = UserModel.setActive(id, active);
  if (!ok) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
  return res.json({ success: true, data: { id, active } });
};

