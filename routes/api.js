// routes/api.js
// Rotas de API para Recados (CRUD básico + estatísticas).
// Padrões: respostas em pt-BR, JSON consistente e tratamento de erros.

const express = require('express');
const router = express.Router();

const RecadoModel = require('../models/recado');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de resposta

function ok(res, dados) {
  return res.json({ sucesso: true, dados });
}

function fail(res, status, mensagem, detalhe) {
  const payload = { sucesso: false, erro: mensagem };
  if (process.env.NODE_ENV === 'development' && detalhe) {
    payload.detalhe = String(detalhe);
  }
  return res.status(status).json(payload);
}

// Validação mínima de criação/atualização (alinha com schema do SQLite)
function validarEntrada(base) {
  const faltando = [];
  if (!base.data_ligacao) faltando.push('data_ligacao');
  if (!base.hora_ligacao) faltando.push('hora_ligacao');
  if (!base.destinatario) faltando.push('destinatario');
  if (!base.remetente_nome) faltando.push('remetente_nome');
  if (!base.assunto) faltando.push('assunto');
  if (!base.mensagem) faltando.push('mensagem (ou preencher observacoes)');
  return faltando;
}

// Normaliza body e aplica fallback de mensagem ← observacoes
function normalizarBody(b = {}) {
  const dados = {
    data_ligacao: String(b.data_ligacao || '').trim(),
    hora_ligacao: String(b.hora_ligacao || '').trim(),
    destinatario: String(b.destinatario || '').trim(),
    remetente_nome: String(b.remetente_nome || '').trim(),
    remetente_telefone: b.remetente_telefone ? String(b.remetente_telefone).trim() : null,
    remetente_email: b.remetente_email ? String(b.remetente_email).trim() : null,
    assunto: String(b.assunto || '').trim(),
    mensagem: String((b.mensagem ?? b.observacoes ?? '')).trim(), // ← essencial p/ NOT NULL
    situacao: b.situacao || 'pendente', // 'pendente' | 'em_andamento' | 'resolvido'
    horario_retorno: b.horario_retorno ? String(b.horario_retorno).trim() : null,
    observacoes: b.observacoes ? String(b.observacoes).trim() : null
  };
  return dados;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rotas de Recados

// GET /api/recados?limit=10 — lista recentes (p/ Dashboard e Listagem)
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

// GET /api/recados/estatisticas — cards do Dashboard
router.get('/recados/estatisticas', (_req, res) => {
  try {
    const r = RecadoModel.estatisticas(); // { total, pendentes, em_andamento, resolvidos }
    return ok(res, r);
  } catch (e) {
    console.error('[recados] erro nas estatísticas:', e);
    return fail(res, 500, 'Erro ao carregar estatísticas.', e);
  }
});

// GET /api/recados/:id — detalhe
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

// POST /api/recados — criar
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

// PUT /api/recados/:id — atualizar
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

// DELETE /api/recados/:id — excluir
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

module.exports = router;

