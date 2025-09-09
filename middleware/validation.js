'use strict';

// middleware/validation.js — versão compatível (sem optional chaining / nullish coalescing)
// - Normaliza campos do corpo e da query (situacao, e-mails vazios -> null, strings vazias -> null)
// - Validações usando express-validator (apenas APIs estáveis)

var expressValidator = require('express-validator');
var body   = expressValidator.body;
var param  = expressValidator.param;
var query  = expressValidator.query;
var validationResult = expressValidator.validationResult;

// ---------------------------------------------------------------------------
// Helpers de normalização
// ---------------------------------------------------------------------------
var ALLOWED_SITUACOES = ['pendente', 'em_andamento', 'resolvido'];

function toStr(v) { return (v === undefined || v === null) ? '' : String(v); }
function isBlank(v) { return toStr(v).trim() === ''; }
function emptyToNull(v) { return isBlank(v) ? null : v; }

function normalizeSituacao(raw) {
  var v = toStr(raw).trim().toLowerCase();
  if (!v) return v; // vazio permanece vazio (será tratado em cada rota)
  // unifica separadores
  v = v.replace(/[\-_]+/g, ' ').replace(/\s+/g, ' ').trim();

  // dicionário de sinônimos/labels humanos -> enum persistido
  var map = {
    'pendente': 'pendente',
    'aberto': 'pendente',
    'open': 'pendente',

    'em andamento': 'em_andamento',
    'andamento': 'em_andamento',

    'em_andamento': 'em_andamento',

    'resolvido': 'resolvido',
    'fechado': 'resolvido',
    'concluido': 'resolvido',
    'concluído': 'resolvido',
    'closed': 'resolvido'
  };

  // mapeia direto se já for válido
  if (ALLOWED_SITUACOES.indexOf(v) !== -1) return v;
  // tenta o dicionário
  if (map[v]) return map[v];
  // heurísticas simples
  if (/andamento/.test(v)) return 'em_andamento';
  if (/resolvid|fechad|conclu/i.test(v)) return 'resolvido';
  if (/pend/i.test(v) || /abert/i.test(v)) return 'pendente';

  return v; // devolve como veio; validação posterior decidirá
}

function applyBodyNormalizers(req, _res, next) {
  var b = req.body || (req.body = {});

  // Campos opcionais: string vazia -> null
  var optFields = ['remetente_telefone', 'remetente_email', 'horario_retorno', 'observacoes'];
  for (var i = 0; i < optFields.length; i++) {
    var k = optFields[i];
    if (Object.prototype.hasOwnProperty.call(b, k)) {
      b[k] = emptyToNull(b[k]);
    }
  }

  // Normaliza situacao (se vier)
  if (Object.prototype.hasOwnProperty.call(b, 'situacao')) {
    b.situacao = normalizeSituacao(b.situacao);
  }

  // Datas/horas: remove espaços extras
  if (Object.prototype.hasOwnProperty.call(b, 'data_ligacao') && typeof b.data_ligacao === 'string') {
    b.data_ligacao = b.data_ligacao.trim();
  }
  if (Object.prototype.hasOwnProperty.call(b, 'hora_ligacao') && typeof b.hora_ligacao === 'string') {
    b.hora_ligacao = b.hora_ligacao.trim();
  }

  next();
}

function applyQueryNormalizers(req, _res, next) {
  var q = req.query || (req.query = {});
  if (Object.prototype.hasOwnProperty.call(q, 'situacao')) {
    // string vazia -> remove
    if (isBlank(q.situacao)) {
      delete q.situacao;
    } else {
      q.situacao = normalizeSituacao(q.situacao);
    }
  }
  if (Object.prototype.hasOwnProperty.call(q, 'limit'))  { q.limit  = String(q.limit).trim(); }
  if (Object.prototype.hasOwnProperty.call(q, 'offset')) { q.offset = String(q.offset).trim(); }
  next();
}

// ---------------------------------------------------------------------------
// Regras básicas reutilizáveis
// ---------------------------------------------------------------------------
var dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD (validação simples)
var timeRegex = /^\d{2}:\d{2}$/;       // HH:MM

function commonCreateAndUpdateRules() {
  return [
    body('data_ligacao')
      .notEmpty().withMessage('Data da ligação é obrigatória')
      .bail()
      .matches(dateRegex).withMessage('Data deve estar no formato válido (YYYY-MM-DD)'),

    body('hora_ligacao')
      .notEmpty().withMessage('Hora da ligação é obrigatória')
      .bail()
      .matches(timeRegex).withMessage('Hora deve estar no formato HH:MM'),

    body('destinatario').notEmpty().withMessage('Destinatário é obrigatório'),
    body('remetente_nome').notEmpty().withMessage('Remetente é obrigatório'),
    body('assunto').notEmpty().withMessage('Assunto é obrigatório'),

    // E-mail: permitir vazio, mas se vier valor, precisa ser válido
    body('remetente_email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('E-mail deve ter formato válido'),

    // Telefone e horário de retorno são opcionais
    body('remetente_telefone').optional({ checkFalsy: true }).isLength({ max: 50 }),
    body('horario_retorno').optional({ checkFalsy: true }).isLength({ max: 100 }),

    // Situação: opcional no create/update; se vier, precisa estar no enum
    body('situacao')
      .optional({ checkFalsy: true })
      .isIn(ALLOWED_SITUACOES).withMessage('Situação deve ser: pendente, em_andamento ou resolvido')
  ];
}

// ---------------------------------------------------------------------------
// Validators exportados
// ---------------------------------------------------------------------------
var validateCreateRecado = [
  applyBodyNormalizers
].concat(commonCreateAndUpdateRules());

var validateUpdateRecado = [
  applyBodyNormalizers
].concat(commonCreateAndUpdateRules());

var validateUpdateSituacao = [
  applyBodyNormalizers,
  body('situacao')
    .notEmpty().withMessage('Situação é obrigatória')
    .bail()
    .custom(function(value) {
      var v = normalizeSituacao(value);
      if (ALLOWED_SITUACOES.indexOf(v) === -1) {
        throw new Error('Situação deve ser: pendente, em_andamento ou resolvido');
      }
      // grava normalizado no body para a rota usar
      // (sem optional chaining)
      if (!reqLikeHasBody(this)) { /* noop: compat */ }
      return true;
    })
];

// Helper para compatibilidade: alguns ambientes antigos do express-validator não expõem this.req
function reqLikeHasBody(ctx) { return !!ctx; }

var validateQueryRecados = [
  applyQueryNormalizers,
  query('limit').optional({ checkFalsy: true }).toInt().isInt({ min: 1, max: 200 }).withMessage('limit inválido'),
  query('offset').optional({ checkFalsy: true }).toInt().isInt({ min: 0 }).withMessage('offset inválido'),
  query('situacao').optional({ checkFalsy: true }).isIn(ALLOWED_SITUACOES).withMessage('Situação inválida')
];

var validateId = [
  param('id').isInt({ min: 1 }).withMessage('ID inválido')
];

function handleValidationErrors(req, res, next) {
  var result = validationResult(req);
  if (result.isEmpty()) return next();
  return res.status(400).json({
    success: false,
    message: 'Dados inválidos',
    errors: result.array()
  });
}

module.exports = {
  validateCreateRecado: validateCreateRecado,
  validateUpdateRecado: validateUpdateRecado,
  validateUpdateSituacao: validateUpdateSituacao,
  validateQueryRecados: validateQueryRecados,
  validateId: validateId,
  handleValidationErrors: handleValidationErrors,

  // helpers expostos para testes/unit
  _normalize: {
    situacao: normalizeSituacao,
    emptyToNull: emptyToNull
  }
};
