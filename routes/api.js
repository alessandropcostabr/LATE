// routes/api.js
// Rotas de API – Recados (pt-BR no payload) + Users (padrão internacional nos campos).
// Mantém respostas JSON padronizadas e evita mexer em views/public.
//
// Observações:
// - /api/users* NÃO usa CSRF (recomendado para API).
// - As rotas de recados permanecem como você já usa (pt-BR / schema atual).
// - Em desenvolvimento, há um /api/whoami opcional para inspecionar a sessão.

const express = require('express');
const router  = express.Router();

// ───────────────────────────────────────────────────────────
// Controllers
// ───────────────────────────────────────────────────────────
const RecadoModel = require('../models/recado');
const userController = require('../controllers/userController');

const {
   validateCreateRecado, validateUpdateRecado, validateUpdateSituacao,
   validateQueryRecados, validateId, handleValidationErrors
} = require('../middleware/validation');

// ───────────────────────────────────────────────────────────
// Helpers de resposta (recados)
// ───────────────────────────────────────────────────────────
function ok(res, dados) {
  return res.json({ sucesso: true, dados });
}
function fail(res, status, mensagem, detalhe) {
  const payload = { sucesso: false, erro: mensagem };
  if (process.env.NODE_ENV === 'development' && detalhe) payload.detalhe = String(detalhe);
  return res.status(status).json(payload);
}

// Validação mínima para criação/atualização de recado
function validarEntrada(base) {
  const faltando = [];
  if (!base.data_ligacao)   faltando.push('data_ligacao');
  if (!base.hora_ligacao)   faltando.push('hora_ligacao');
  if (!base.destinatario)   faltando.push('destinatario');
  if (!base.remetente_nome) faltando.push('remetente_nome');
  if (!base.assunto)        faltando.push('assunto');
  if (!base.mensagem)       faltando.push('mensagem (ou preencher observacoes)');
  return faltando;
}
// Normaliza body e aplica fallback de mensagem ← observacoes
function normalizarBody(b = {}) {
  return {
    data_ligacao:       String(b.data_ligacao || '').trim(),
    hora_ligacao:       String(b.hora_ligacao || '').trim(),
    destinatario:       String(b.destinatario || '').trim(),
    remetente_nome:     String(b.remetente_nome || '').trim(),
    remetente_telefone: b.remetente_telefone ? String(b.remetente_telefone).trim() : null,
    remetente_email:    b.remetente_email ? String(b.remetente_email).trim() : null,
    assunto:            String(b.assunto || '').trim(),
    mensagem:           String((b.mensagem ?? b.observacoes ?? '')).trim(),
    situacao:           b.situacao || 'pendente',
    horario_retorno:    b.horario_retorno ? String(b.horario_retorno).trim() : null,
    observacoes:        b.observacoes ? String(b.observacoes).trim() : null
  };
}

// ───────────────────────────────────────────────────────────
// RECADOS (pt-BR, mantém seu schema atual)
// ───────────────────────────────────────────────────────────

router.get('/recados', (req, res) => {
  try {
    const lim = Number(req.query.limit || 10);
    const rows = RecadoModel.listarRecentes(isNaN(lim) ? 10 : lim);
    return ok(res, rows);
  } catch (e) {
    console.error('[recados] erro ao listar:', e);
    return fail(res, 500, 'Erro ao listar recados.', e);
  }
});

router.get('/recados/estatisticas', (_req, res) => {
  try {
    const r = RecadoModel.estatisticas();
    return ok(res, r);
  } catch (e) {
    console.error('[recados] erro nas estatísticas:', e);
    return fail(res, 500, 'Erro ao carregar estatísticas.', e);
  }
});

router.get('/recados/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'ID inválido.');
    const row = RecadoModel.obterPorId(id);
    if (!row) return fail(res, 404, 'Recado não encontrado.');
    return ok(res, row);
  } catch (e) {
    console.error('[recados] erro ao obter:', e);
    return fail(res, 500, 'Erro ao obter recado.', e);
  }
});

router.post('/recados', (req, res) => {
  try {
    const dados = normalizarBody(req.body);
    const faltando = validarEntrada(dados);
    if (faltando.length) {
      return fail(res, 400, `Campos obrigatórios ausentes: ${faltando.join(', ')}.`);
    }
    const id = RecadoModel.create(dados);
    return res.status(201).json({ sucesso: true, id });
  } catch (e) {
    console.error('[recados] erro ao criar:', e);
    return fail(res, 500, 'Erro interno ao criar recado.', e);
  }
});

router.put('/recados/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'ID inválido.');
    const dados = normalizarBody(req.body);
    const faltando = validarEntrada(dados);
    if (faltando.length) {
      return fail(res, 400, `Campos obrigatórios ausentes: ${faltando.join(', ')}.`);
    }
    const okUpd = RecadoModel.atualizar(id, dados);
    if (!okUpd) return fail(res, 404, 'Recado não encontrado para atualização.');
    return ok(res, { id, atualizado: true });
  } catch (e) {
    console.error('[recados] erro ao atualizar:', e);
    return fail(res, 500, 'Erro ao atualizar recado.', e);
  }
});

router.delete('/recados/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return fail(res, 400, 'ID inválido.');
    const okDel = RecadoModel.excluir(id);
    if (!okDel) return fail(res, 404, 'Recado não encontrado para exclusão.');
    return ok(res, { id, excluido: true });
  } catch (e) {
    console.error('[recados] erro ao excluir:', e);
    return fail(res, 500, 'Erro ao excluir recado.', e);
  }
});

// Health-check da API
router.get('/healthz', (_req, res) => res.json({ ok: true }));

// ───────────────────────────────────────────────────────────
// USERS (padrão internacional nos campos; mensagens pt-BR)
// ───────────────────────────────────────────────────────────

router.get('/users', userController.list);               // lista paginada
router.post('/users', userController.create);            // cria usuário
router.patch('/users/:id/active', userController.setActive); // ativa/inativa

// Opcional (DEV): inspecionar sessão atual
if (process.env.NODE_ENV === 'development') {
  router.get('/whoami', (req, res) => {
    res.json({ success: true, user: req.session?.usuario || null });
  });
}

module.exports = router;

