// controllers/userController.js
// Users API – payloads em inglês e mensagens em pt-BR.

const { validationResult } = require('express-validator');
const argon2 = require('argon2');
const UserModel = require('../models/user');
const UserSector = require('../models/userSector');

const ALLOWED_ROLES = ['ADMIN', 'SUPERVISOR', 'OPERADOR', 'LEITOR'];
const ALLOWED_VIEW_SCOPES = ['own', 'all'];

function normalizeRole(role) {
  const value = String(role || 'OPERADOR').trim().toUpperCase();
  return ALLOWED_ROLES.includes(value) ? value : 'OPERADOR';
}

function normalizeViewScope(scope) {
  const value = String(scope || 'all').trim().toLowerCase();
  return ALLOWED_VIEW_SCOPES.includes(value) ? value : 'all';
}

function parseBooleanFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function sanitizeUser(user) {
  if (!user) return null;
  const { password_hash, ...rest } = user;
  return rest;
}

function isEmailUniqueViolation(err) {
  if (!err) return false;
  if (err.code === '23505') {
    const message = String(err.message || '').toLowerCase();
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

  const rawRole = typeof req.query.role === 'string' ? req.query.role : '';
  const normalizedRole = rawRole.trim().toUpperCase();
  const role = ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : undefined;

  const rawStatus = typeof req.query.status === 'string' ? req.query.status : '';
  const normalizedStatus = rawStatus.trim().toLowerCase();
  const status = ['active', 'inactive'].includes(normalizedStatus) ? normalizedStatus : undefined;
  try {
    const r = await UserModel.list({ q, page, limit, role, status });
    const users = Array.isArray(r.data) ? r.data.map(sanitizeUser) : [];
    return res.json({ success: true, data: users, pagination: r.pagination });
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
  const role     = normalizeRole(req.body.role);
  const active   = req.body.active !== undefined ? parseBooleanFlag(req.body.active) : true;
  const sectorIds = Array.isArray(req.body.sectorIds)
    ? req.body.sectorIds.map((id) => Number(id)).filter(Number.isFinite)
    : [];
  const viewScope = normalizeViewScope(req.body.viewScope ?? req.body.view_scope);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array(),
    });
  }

  try {
    if (!sectorIds.length) {
      return res.status(400).json({ success: false, error: 'Selecione pelo menos um setor.' });
    }

    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    const created = await UserModel.create({ name, email, password_hash, role, active, view_scope: viewScope });

    try {
      await UserSector.setUserSectors(created.id, sectorIds);
    } catch (sectorErr) {
      // Evita usuário órfão caso associação falhe
      try { await UserModel.remove(created.id); } catch (cleanupErr) {
        console.error('[users] create rollback falhou:', cleanupErr);
      }

      if (['VALIDATION', 'SECTOR_MIN_ONE', 'USER_MIN_ONE'].includes(sectorErr.code)) {
        return res.status(400).json({ success: false, error: sectorErr.message });
      }
      if (sectorErr.code === 'USER_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
      }
      console.error('[users] setUserSectors após criação falhou:', sectorErr);
      return res.status(500).json({ success: false, error: 'Erro interno ao associar setores.' });
    }

    const user = await UserModel.findById(created.id);
    const sectors = await UserSector.listUserSectors(created.id);
    return res.status(201).json({ success: true, data: { user: sanitizeUser(user), sectors } });
  } catch (err) {
    if (isEmailUniqueViolation(err)) {
      return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
    }
    console.error('[users] create error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao criar usuário.' });
  }
};

// GET /api/users/:id
exports.getById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await UserModel.findById(id);
    if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    return res.json({ success: true, data: { user: sanitizeUser(user) } });
  } catch (err) {
    console.error('[users] getById error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao obter usuário.' });
  }
};

// PUT /api/users/:id
exports.update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }

  try {
    const id = Number(req.params.id);
    const sessionUserId = Number(req.session?.user?.id);
    const targetUser = await UserModel.findById(id);
    if (!targetUser) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    const payload = {};
    if (req.body.name !== undefined) payload.name = String(req.body.name || '').trim();
    if (req.body.email !== undefined) payload.email = String(req.body.email || '').trim().toLowerCase();
    if (req.body.role !== undefined) payload.role = normalizeRole(req.body.role);
    if (req.body.active !== undefined) payload.active = parseBooleanFlag(req.body.active);
    if (req.body.viewScope !== undefined || req.body.view_scope !== undefined) {
      payload.view_scope = normalizeViewScope(req.body.viewScope ?? req.body.view_scope);
    }

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ success: false, error: 'Nenhum dado para atualizar.' });
    }

    const currentRole = targetUser.role;
    const currentActive = targetUser.is_active;
    const nextRole = payload.role || currentRole;
    const nextActive = payload.active !== undefined ? payload.active : currentActive;

    if (sessionUserId === id && currentRole === 'ADMIN' && nextRole !== 'ADMIN') {
      return res.status(400).json({ success: false, error: 'Não é possível remover o próprio acesso de administrador.' });
    }

    if (currentRole === 'ADMIN' && currentActive) {
      if (nextRole !== 'ADMIN' || nextActive === false) {
        const remainingAdmins = await UserModel.countActiveAdmins({ excludeId: id });
        if (remainingAdmins === 0) {
          return res.status(400).json({ success: false, error: 'É necessário manter ao menos um administrador ativo no sistema.' });
        }
      }
    }

    const updated = await UserModel.update(id, payload);
    if (!updated) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    return res.json({ success: true, data: { user: sanitizeUser(updated) } });
  } catch (err) {
    if (isEmailUniqueViolation(err)) {
      return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
    }
    console.error('[users] update error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao atualizar usuário.' });
  }
};

// PUT /api/users/:id/status
exports.updateStatus = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }

  try {
    const id = Number(req.params.id);
    const sessionUserId = Number(req.session?.user?.id);
    const active = parseBooleanFlag(req.body.active);

    const targetUser = await UserModel.findById(id);
    if (!targetUser) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    if (!active) {
      if (sessionUserId === id) {
        return res.status(400).json({ success: false, error: 'Não é possível desativar o próprio usuário.' });
      }

      if (targetUser.role === 'ADMIN' && targetUser.is_active) {
        const remainingAdmins = await UserModel.countActiveAdmins({ excludeId: id });
        if (remainingAdmins === 0) {
          return res.status(400).json({ success: false, error: 'É necessário manter ao menos um administrador ativo no sistema.' });
        }
      }
    }

    const ok = await UserModel.setActive(id, active);
    if (!ok) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    return res.json({ success: true, data: { id, active } });
  } catch (err) {
    console.error('[users] updateStatus error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao atualizar usuário.' });
  }
};

// PUT /api/users/:id/password
exports.resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: 'Dados inválidos', details: errors.array() });
  }

  try {
    const id = Number(req.params.id);
    const newPassword = String(req.body.password || '').trim();
    const password_hash = await argon2.hash(newPassword, { type: argon2.argon2id });
    const ok = await UserModel.resetPassword(id, password_hash);
    if (!ok) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[users] resetPassword error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao redefinir senha.' });
  }
};

// DELETE /api/users/:id
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const sessionUserId = Number(req.session?.user?.id);

    if (sessionUserId === id) {
      return res.status(400).json({ success: false, error: 'Não é possível remover o próprio usuário.' });
    }

    const targetUser = await UserModel.findById(id);
    if (!targetUser) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

    if (targetUser.role === 'ADMIN' && targetUser.is_active) {
      const remainingAdmins = await UserModel.countActiveAdmins({ excludeId: id });
      if (remainingAdmins === 0) {
        return res.status(400).json({ success: false, error: 'É necessário manter ao menos um administrador ativo no sistema.' });
      }
    }

    const result = await UserModel.deleteUserSafely(id);
    if (!result.deleted) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }

    return res.json({ success: true, data: { deleted: true, message: 'Usuário removido com sucesso.' } });
  } catch (err) {
    if (err && err.code === 'HAS_MESSAGES') {
      return res.status(409).json({
        success: false,
        error: 'Usuário possui recados associados e não pode ser excluído. Você pode inativá-lo.',
      });
    }
    if (err && err.code === 'SECTOR_MIN_ONE') {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err && (err.code === 'USER_MIN_ONE' || (err.code === '23514' && /Usuário precisa estar associado/.test(String(err.message || ''))))) {
      return res.status(409).json({
        success: false,
        error: 'Não é possível remover o usuário porque ele ainda está associado a um ou mais setores.',
      });
    }
    if (err && err.code === '23514' && /Setor precisa/.test(String(err.message || ''))) {
      return res.status(400).json({ success: false, error: 'Algum setor ficaria sem usuários. Ajuste os setores antes de remover o usuário.' });
    }
    if (err && err.code === 'INTERNAL' && /Usuário precisa estar associado/.test(String(err.message || ''))) {
      return res.status(409).json({
        success: false,
        error: 'Não é possível remover o usuário porque ele ainda está associado a um ou mais setores.',
      });
    }
    console.error('[users] remove error:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao remover usuário.' });
  }
};
