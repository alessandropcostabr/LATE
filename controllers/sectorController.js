// controllers/sectorController.js
// Endpoints admin para Setores. Mensagens em pt-BR; chaves JSON em inglês.

const { validationResult, body, param, query } = require('express-validator');
const Sector = require('../models/sector');
const UserSector = require('../models/userSector');

// Util: envia 400 com erros de validação em pt-BR
function sendValidation(res, errors) {
  return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join('; ') });
}

// Validations
exports.validateList = [
  query('q').optional().isString().withMessage('Busca inválida'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página inválida'),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('Limite inválido'),
];

exports.validateCreate = [
  body('name').isString().withMessage('Nome inválido').bail()
    .trim().notEmpty().withMessage('Nome do setor é obrigatório').bail()
    .isLength({ max: 120 }).withMessage('Nome do setor não pode exceder 120 caracteres'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('E-mail de setor inválido'),
];

exports.validateUpdate = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  ...exports.validateCreate,
];

exports.validateToggle = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido'),
  body('is_active').isBoolean().withMessage('Valor inválido para ativo'),
];

exports.validateUserSectors = [
  param('id').isInt({ min: 1 }).withMessage('ID de usuário inválido'),
  body('sectorIds').isArray({ min: 1 }).withMessage('Pelo menos um setor deve ser selecionado'),
  body('sectorIds.*').isInt({ min: 1 }).withMessage('IDs de setor inválidos'),
];

// Handlers
exports.list = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidation(res, errors);

  const { q, page, limit } = req.query;
  const result = await Sector.list({ q, page, limit });
  return res.json({ success: true, data: result });
};

exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidation(res, errors);

  try {
    const created = await Sector.create(req.body);
    return res.status(201).json({ success: true, data: created, message: 'Setor criado com sucesso' });
  } catch (err) {
    if (err.code === 'VALIDATION') {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err.code === 'UNIQUE') {
      return res.status(409).json({ success: false, error: err.message });
    }
    console.error('[sectors/create] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar setor' });
  }
};

exports.update = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidation(res, errors);

  const id = Number(req.params.id);
  try {
    const ok = await Sector.update(id, req.body);
    if (!ok) return res.status(404).json({ success: false, error: 'Setor não encontrado' });
    const data = await Sector.getById(id);
    return res.json({ success: true, data, message: 'Setor atualizado com sucesso' });
  } catch (err) {
    if (err.code === 'VALIDATION') return res.status(400).json({ success: false, error: err.message });
    if (err.code === 'UNIQUE') return res.status(409).json({ success: false, error: err.message });
    console.error('[sectors/update] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar setor' });
  }
};

exports.toggle = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidation(res, errors);

  const id = Number(req.params.id);
  const { is_active } = req.body;
  try {
    const ok = await Sector.setActive(id, is_active);
    if (!ok) return res.status(404).json({ success: false, error: 'Setor não encontrado' });
    const data = await Sector.getById(id);
    return res.json({ success: true, data, message: is_active ? 'Setor ativado' : 'Setor desativado' });
  } catch (err) {
    console.error('[sectors/toggle] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao alterar status do setor' });
  }
};

exports.remove = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const ok = await Sector.remove(id);
    if (!ok) return res.status(404).json({ success: false, error: 'Setor não encontrado' });
    return res.json({ success: true, message: 'Setor excluído com sucesso' });
  } catch (err) {
    if (err.code === 'SECTOR_HAS_USERS') {
      return res.status(400).json({ success: false, error: err.message });
    }
    console.error('[sectors/remove] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir setor' });
  }
};

exports.getUserSectors = async (req, res) => {
  const userId = Number(req.params.id);
  try {
    const data = await UserSector.listUserSectors(userId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[users/sectors/get] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter setores do usuário' });
  }
};

exports.setUserSectors = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return sendValidation(res, errors);

  const userId = Number(req.params.id);
  const { sectorIds } = req.body;
  try {
    const data = await UserSector.setUserSectors(userId, sectorIds);
    return res.json({ success: true, data, message: 'Setores atualizados com sucesso.' });
  } catch (err) {
    if (['VALIDATION', 'SECTOR_MIN_ONE', 'USER_MIN_ONE'].includes(err.code)) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err.code === 'USER_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' });
    }
    console.error('[users/sectors/set] erro:', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar setores do usuário' });
  }
};

