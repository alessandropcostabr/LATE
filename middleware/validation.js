'use strict';

// middleware/validation.js — versão compatível (sem optional chaining / nullish coalescing)
// - Normaliza campos do corpo e da query (status, e-mails vazios -> null, strings vazias -> null)
// - Validações usando express-validator (apenas APIs estáveis)

var expressValidator = require('express-validator');
var body   = expressValidator.body;
var param  = expressValidator.param;
var query  = expressValidator.query;
var validationResult = expressValidator.validationResult;

var MessageModel = require('../models/message');

// ---------------------------------------------------------------------------
// Helpers de normalização
// ---------------------------------------------------------------------------
var ALLOWED_STATUS = MessageModel.STATUS_VALUES;

function toStr(v) { return (v === undefined || v === null) ? '' : String(v); }
function isBlank(v) { return toStr(v).trim() === ''; }
function emptyToNull(v) { return isBlank(v) ? null : v; }

function normalizeStatus(raw) {
  var value = toStr(raw).trim();
  if (!value) return '';
  return MessageModel.normalizeStatus(value);
}

function applyBodyNormalizers(req, _res, next) {
  var b = req.body || (req.body = {});

  // Campos opcionais: string vazia -> null
  var optFields = ['sender_phone', 'sender_email', 'callback_time', 'notes'];
  for (var i = 0; i < optFields.length; i++) {
    var k = optFields[i];
    if (Object.prototype.hasOwnProperty.call(b, k)) {
      b[k] = emptyToNull(b[k]);
    }
  }

  if (Object.prototype.hasOwnProperty.call(b, 'status')) {
    var normalizedStatus = normalizeStatus(b.status);
    b.status = normalizedStatus || '';
  }

  if (Object.prototype.hasOwnProperty.call(b, 'call_date') && typeof b.call_date === 'string') {
    b.call_date = b.call_date.trim();
  }
  if (Object.prototype.hasOwnProperty.call(b, 'call_time') && typeof b.call_time === 'string') {
    b.call_time = b.call_time.trim();
  }

  next();
}

function applyQueryNormalizers(req, _res, next) {
  var q = req.query || (req.query = {});
  if (Object.prototype.hasOwnProperty.call(q, 'status')) {
    if (isBlank(q.status)) {
      delete q.status;
    } else {
      q.status = normalizeStatus(q.status);
    }
  }
  if (Object.prototype.hasOwnProperty.call(q, 'limit'))  { q.limit  = String(q.limit).trim(); }
  if (Object.prototype.hasOwnProperty.call(q, 'offset')) { q.offset = String(q.offset).trim(); }
  var optionalFields = ['start_date', 'end_date', 'recipient'];
  for (var i = 0; i < optionalFields.length; i++) {
    var field = optionalFields[i];
    if (Object.prototype.hasOwnProperty.call(q, field)) {
      var value = toStr(q[field]).trim();
      if (!value) {
        delete q[field];
      } else {
        q[field] = value;
      }
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// Regras básicas reutilizáveis
// ---------------------------------------------------------------------------
var dateRegex = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD (validação simples)
var timeRegex = /^\d{2}:\d{2}$/;       // HH:MM

function commonCreateAndUpdateRules() {
  return [
    body('call_date')
      .notEmpty().withMessage('Data da ligação é obrigatória')
      .bail()
      .matches(dateRegex).withMessage('Data deve estar no formato válido (YYYY-MM-DD)'),

    body('call_time')
      .notEmpty().withMessage('Hora da ligação é obrigatória')
      .bail()
      .matches(timeRegex).withMessage('Hora deve estar no formato HH:MM'),

    body('recipient').notEmpty().withMessage('Destinatário é obrigatório'),
    body('sender_name').notEmpty().withMessage('Remetente é obrigatório'),
    body('subject').notEmpty().withMessage('Assunto é obrigatório'),

    body('sender_email')
      .optional({ checkFalsy: true })
      .isEmail().withMessage('E-mail deve ter formato válido'),

    body('sender_phone').optional({ checkFalsy: true }).isLength({ max: 50 }),
    body('callback_time').optional({ checkFalsy: true }).isLength({ max: 100 }),

    body('status')
      .optional({ checkFalsy: true })
      .custom(function(value) {
        var normalized = normalizeStatus(value);
        if (normalized && ALLOWED_STATUS.indexOf(normalized) === -1) {
          throw new Error('Status deve ser: pending, in_progress ou resolved');
        }
        return true;
      })
      .customSanitizer(function(value) {
        return normalizeStatus(value);
      }),
  ];
}

// ---------------------------------------------------------------------------
// Validators exportados
// ---------------------------------------------------------------------------
var validateCreateMessage = [
  applyBodyNormalizers
].concat(commonCreateAndUpdateRules());

var validateUpdateMessage = [
  applyBodyNormalizers
].concat(commonCreateAndUpdateRules());

var validateUpdateStatus = [
  applyBodyNormalizers,
  body('status')
    .notEmpty().withMessage('Status é obrigatório')
    .bail()
    .custom(function(value) {
      var normalized = normalizeStatus(value);
      if (!normalized || ALLOWED_STATUS.indexOf(normalized) === -1) {
        throw new Error('Status deve ser: pending, in_progress ou resolved');
      }
      return true;
    })
    .customSanitizer(function(value) {
      return normalizeStatus(value);
    })
];

var validateQueryMessages = [
  applyQueryNormalizers,
  query('limit').optional({ checkFalsy: true }).toInt().isInt({ min: 1, max: 200 }).withMessage('limit inválido'),
  query('offset').optional({ checkFalsy: true }).toInt().isInt({ min: 0 }).withMessage('offset inválido'),
  query('start_date')
    .optional({ checkFalsy: true })
    .matches(dateRegex).withMessage('start_date inválido'),
  query('end_date')
    .optional({ checkFalsy: true })
    .matches(dateRegex).withMessage('end_date inválido')
    .custom(function(value, meta) {
      var req = meta.req || {};
      if (value && req.query && req.query.start_date && value < req.query.start_date) {
        throw new Error('end_date deve ser igual ou posterior a start_date');
      }
      return true;
    }),
  query('recipient')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('recipient muito longo'),
  query('status')
    .optional({ checkFalsy: true })
    .custom(function(value) {
      var normalized = normalizeStatus(value);
      if (!normalized || ALLOWED_STATUS.indexOf(normalized) === -1) {
        throw new Error('Status inválido');
      }
      return true;
    })
    .customSanitizer(function(value) {
      return normalizeStatus(value);
    })
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
  validateCreateMessage: validateCreateMessage,
  validateUpdateMessage: validateUpdateMessage,
  validateUpdateStatus: validateUpdateStatus,
  validateQueryMessages: validateQueryMessages,
  validateId: validateId,
  handleValidationErrors: handleValidationErrors,

  // helpers expostos para testes/unit
  _normalize: {
    status: normalizeStatus,
    emptyToNull: emptyToNull
  }
};

// Compat aliases temporários
module.exports.validateCreateRecado = module.exports.validateCreateMessage;
module.exports.validateUpdateRecado = module.exports.validateUpdateMessage;
module.exports.validateUpdateSituacao = module.exports.validateUpdateStatus;
module.exports.validateQueryRecados = module.exports.validateQueryMessages;
