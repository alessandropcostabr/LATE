// controllers/userController.js
// Users API – payloads em inglês e mensagens em pt-BR.

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');

function isEmailUniqueViolation(err) {
  if (!err) return false;
  const message = String(err.message || '').toLowerCase();
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return true;
  if (err.code === 'SQLITE_CONSTRAINT' && message.includes('users.email')) return true;
  if (err.code === '23505') {
    const constraint = String(err.constraint || '').toLowerCase();
    return constraint.includes('users_email') || message.includes('users_email');
  }
  return false;
}

// GET /api/users
exports.list = async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 10;
  const q     = String(req.query.q || '');
  try {
    const r = await UserModel.list({ q, page, limit });
    return res.json({ success: true, data: r.data, pagination: r.pagination });
  } catch (err) {
    console.error('[users] list error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao listar usuários.' });
  }
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
    const user = await UserModel.create({ name, email, password_hash, role });
    return res.status(201).json({ success: true, data: user });
  } catch (err) {
    if (isEmailUniqueViolation(err)) {
      return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
    }
    console.error('[users] create error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao criar usuário.' });
  }
};

// PATCH /api/users/:id/active
exports.setActive = async (req, res) => {
  const id = Number(req.params.id);
  const activeInput = req.body.active;
  const active = activeInput === true || activeInput === 'true' || activeInput === 1 || activeInput === '1';
  try {
    const ok = await UserModel.setActive(id, active);
    if (!ok) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    return res.json({ success: true, data: { id, active } });
  } catch (err) {
    console.error('[users] setActive error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao atualizar usuário.' });
  }
};

