// middleware/validation.js
// Comentários em pt-BR; identificadores em inglês.
// Regras de validação/sanitização centralizadas (express-validator).

const expressValidator = require('express-validator');
var body   = expressValidator.body;
var param  = expressValidator.param;
var query  = expressValidator.query;
var validationResult = expressValidator.validationResult;

// -------------------------------------------------------------
// Helpers comuns
// -------------------------------------------------------------

// Status permitidos no back-end
var ALLOWED_STATUS = ['pending', 'in_progress', 'resolved'];

/**
 * Normaliza valores de status vindos do usuário.
 * Suporta apelidos em pt-BR para conveniência.
 */
function normalizeStatus(s) {
  if (!s) return '';
  var v = String(s).trim().toLowerCase();
  // variações em pt-BR
  if (v === 'pendente' || v === 'pendentes') return 'pending';
  if (v === 'em andamento' || v === 'andamento' || v === 'em_andamento') return 'in_progress';
  if (v === 'resolvido' || v === 'resolvidos') return 'resolved';
  // inglês já padronizado
  if (ALLOWED_STATUS.indexOf(v) !== -1) return v;
  return '';
}

// normaliza campos de body para strings e aplica trim
function applyBodyNormalizers(req, _res, next) {
  var b = req.body || {};
  [
    'recipient',
    'sender_name',
    'sender_phone',
    'sender_email',
    'subject',
    'message',
    'status',
    'call_date',
    'call_time',
    'callback_time',
    'notes'
  ].forEach(function (k) {
    if (b[k] === undefined || b[k] === null) return;
    if (typeof b[k] !== 'string') b[k] = String(b[k]);
    b[k] = b[k].trim();
  });
  // normaliza status, se presente
  if (b.status) b.status = normalizeStatus(b.status);
  next();
}

// normaliza query strings
function applyQueryNormalizers(req, _res, next) {
  var q = req.query || {};
  Object.keys(q).forEach(function (k) {
    if (typeof q[k] === 'string') q[k] = q[k].trim();
  });
  if (q.status) q.status = normalizeStatus(q.status);
  next();
}

// regex simples para data YYYY-MM-DD
var dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// -------------------------------------------------------------
// Tratamento padrão de erros de validação
// -------------------------------------------------------------
function handleValidationErrors(req, res, next) {
  var errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
}

// -------------------------------------------------------------
// Validators de Messages
// -------------------------------------------------------------

// Criação de recado
var validateCreateMessage = [
  applyBodyNormalizers,

  body('message')
    .notEmpty().withMessage('Mensagem é obrigatória')
    .bail()
    .isLength({ max: 5000 }).withMessage('Mensagem muito longa'),

  body('status')
    .optional({ checkFalsy: true })
    .custom(function (value) {
      var v = normalizeStatus(value);
      if (!v || ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    })
    .customSanitizer(function (value) { return normalizeStatus(value); }),

  body('recipient')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Destinatário muito longo'),

  body('sender_email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('sender_phone')
    .optional({ checkFalsy: true })
    .isLength({ max: 60 }).withMessage('Telefone inválido'),

  body('subject')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Assunto muito longo'),

  body('call_date')
    .optional({ checkFalsy: true })
    .matches(dateRegex).withMessage('Data da chamada inválida (YYYY-MM-DD)'),

  body('call_time')
    .optional({ checkFalsy: true })
    .isLength({ max: 10 }).withMessage('Horário inválido'),

  body('callback_time')
    .optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Horário de retorno inválido')
];

// Atualização completa
var validateUpdateMessage = [
  applyBodyNormalizers,

  body('message')
    .optional({ checkFalsy: true })
    .isLength({ max: 5000 }).withMessage('Mensagem muito longa'),

  body('status')
    .optional({ checkFalsy: true })
    .custom(function (value) {
      var v = normalizeStatus(value);
      if (v && ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    })
    .customSanitizer(function (value) { return normalizeStatus(value); }),

  body('recipient')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Destinatário muito longo'),

  body('sender_email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),

  body('sender_phone')
    .optional({ checkFalsy: true })
    .isLength({ max: 60 }).withMessage('Telefone inválido'),

  body('subject')
    .optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Assunto muito longo'),

  body('call_date')
    .optional({ checkFalsy: true })
    .matches(dateRegex).withMessage('Data da chamada inválida (YYYY-MM-DD)'),

  body('call_time')
    .optional({ checkFalsy: true })
    .isLength({ max: 10 }).withMessage('Horário inválido'),

  body('callback_time')
    .optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Horário de retorno inválido')
];

// Atualização apenas de status
var validateUpdateStatus = [
  applyBodyNormalizers,
  body('status')
    .notEmpty().withMessage('Status é obrigatório')
    .bail()
    .custom(function (value) {
      var v = normalizeStatus(value);
      if (!v || ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    })
    .customSanitizer(function (value) { return normalizeStatus(value); })
];

// ID de rota /:id
var validateId = [
  param('id')
    .notEmpty().withMessage('ID é obrigatório')
    .bail()
    .isInt({ min: 1 }).withMessage('ID inválido')
    .toInt()
];

// -------------------------------------------------------------
// Listagem: validação PERMISSIVA com defaults
// (evita 400 no Dashboard para "Recados Recentes")
// -------------------------------------------------------------
var validateQueryMessages = [
  applyQueryNormalizers,

  // paginação
  query('limit')
    .optional({ checkFalsy: true, nullable: true })
    .isInt({ min: 1, max: 50 }).withMessage('limit inválido')
    .toInt()
    .customSanitizer(function (v) { return (v && v >= 1 && v <= 50) ? v : 10; }),

  query('offset')
    .optional({ checkFalsy: true, nullable: true })
    .isInt({ min: 0 }).withMessage('offset inválido')
    .toInt()
    .customSanitizer(function (v) { return (typeof v === 'number' && v >= 0) ? v : 0; }),

  // filtros
  query('status')
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(function (v) { return normalizeStatus(v); })
    .custom(function (v) {
      if (!v) return true; // opcional
      if (ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    }),

  query('recipient')
    .optional({ checkFalsy: true, nullable: true })
    .isString().trim().isLength({ max: 255 }).withMessage('recipient muito longo'),

  query('q')
    .optional({ checkFalsy: true, nullable: true })
    .isString().trim().isLength({ max: 200 }).withMessage('q inválido'),

  // datas (opcionais no formato YYYY-MM-DD)
  query('start_date')
    .optional({ checkFalsy: true, nullable: true })
    .matches(dateRegex).withMessage('start_date inválida'),

  query('end_date')
    .optional({ checkFalsy: true, nullable: true })
    .matches(dateRegex).withMessage('end_date inválida')
    .custom(function (value, meta) {
      var req = (meta && meta.req) ? meta.req : {};
      var start = (req.query && req.query.start_date) ? req.query.start_date : null;
      if (value && start && value < start) throw new Error('end_date deve ser igual ou posterior a start_date');
      return true;
    }),

  // ordenação
  query('order_by')
    .optional({ checkFalsy: true, nullable: true })
    .isIn(['created_at', 'updated_at', 'status']).withMessage('order_by inválido')
    .customSanitizer(function (v) { return v || 'created_at'; }),

  query('order')
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(function (v) { return (String(v || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'); })
];

// -------------------------------------------------------------
// Exports
// -------------------------------------------------------------
module.exports = {
  handleValidationErrors,
  validateCreateMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateId,
  validateQueryMessages
};

