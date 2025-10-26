// middleware/validation.js
// Comentários em pt-BR; identificadores em inglês.
// Regras de validação/sanitização centralizadas (express-validator).

const expressValidator = require('express-validator');
const body   = expressValidator.body;
const param  = expressValidator.param;
const query  = expressValidator.query;
const validationResult = expressValidator.validationResult;

// -------------------------------------------------------------
// Helpers comuns
// -------------------------------------------------------------

const ALLOWED_STATUS = ['pending', 'in_progress', 'resolved'];

function normalizeStatus(s) {
  if (!s) return '';
  const v = String(s).trim().toLowerCase();
  if (v === 'pendente' || v === 'pendentes') return 'pending';
  if (v === 'em andamento' || v === 'andamento' || v === 'em_andamento') return 'in_progress';
  if (v === 'resolvido' || v === 'resolvidos') return 'resolved';
  if (ALLOWED_STATUS.indexOf(v) !== -1) return v;
  return '';
}

function applyBodyNormalizers(req, _res, next) {
  const b = req.body || {};
  [
    'recipient', 'recipientId', 'sender_name', 'sender_phone', 'sender_email',
    'subject', 'message', 'status', 'call_date', 'call_time',
    'callback_time', 'notes'
  ].forEach((k) => {
    if (b[k] === undefined || b[k] === null) return;
    if (typeof b[k] !== 'string') b[k] = String(b[k]);
    b[k] = b[k].trim();
  });
  if (b.status) b.status = normalizeStatus(b.status);
  next();
}

function applyQueryNormalizers(req, _res, next) {
  const q = req.query || {};
  Object.keys(q).forEach((k) => {
    if (typeof q[k] === 'string') q[k] = q[k].trim();
  });
  if (q.status) q.status = normalizeStatus(q.status);
  next();
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      data: { details: errors.array() }
    });
  }
  next();
}

// -------------------------------------------------------------
// Validators de Messages
// -------------------------------------------------------------
const validateCreateMessage = [
  applyBodyNormalizers,
  body('message').notEmpty().withMessage('Mensagem é obrigatória')
    .bail().isLength({ max: 5000 }).withMessage('Mensagem muito longa'),
  body('status').optional({ checkFalsy: true })
    .custom((value) => {
      const v = normalizeStatus(value);
      if (!v || ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    })
    .customSanitizer((value) => normalizeStatus(value)),
  body('recipientId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Destinatário inválido')
    .toInt(),
  body('recipientUserId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Usuário destinatário inválido')
    .toInt(),
  body('recipientSectorId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Setor destinatário inválido')
    .toInt(),
  body('recipient').optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Destinatário muito longo'),
  body('recipientType').optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Tipo de destinatário inválido'),
  body('sender_email').optional({ checkFalsy: true })
    .isEmail().withMessage('Email inválido').normalizeEmail(),
  body('sender_phone').optional({ checkFalsy: true })
    .isLength({ max: 60 }).withMessage('Telefone inválido'),
  body('subject').optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Assunto muito longo'),
  body('call_date').optional({ checkFalsy: true })
    .matches(dateRegex).withMessage('Data da chamada inválida (YYYY-MM-DD)'),
  body('call_time').optional({ checkFalsy: true })
    .isLength({ max: 10 }).withMessage('Horário inválido'),
  body('callback_time').optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Horário de retorno inválido')
    ,
  body('visibility').optional({ checkFalsy: true })
    .custom((value) => {
      const v = String(value || '').trim().toLowerCase();
      if (v && v !== 'public' && v !== 'private') {
        throw new Error('Visibilidade inválida');
      }
      return true;
    })
    .customSanitizer((value) => String(value || '').trim().toLowerCase()),
  body().custom((_, { req }) => {
    const parseId = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return null;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1) return null;
      return parsed;
    };

    const recipientUserId = parseId(
      req.body.recipientUserId ??
      req.body.recipient_user_id ??
      req.body.recipientId ??
      req.body.recipient_id
    );
    const recipientSectorId = parseId(
      req.body.recipientSectorId ??
      req.body.recipient_sector_id
    );

    if (!recipientUserId && !recipientSectorId) {
      throw new Error('Destinatário é obrigatório');
    }

    if (recipientUserId) req.body.recipientUserId = recipientUserId;
    if (recipientSectorId) req.body.recipientSectorId = recipientSectorId;

    return true;
  })
];

const validateForwardMessage = [
  applyBodyNormalizers,
  body('recipientType').optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Tipo de destinatário inválido'),
  body('recipientUserId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Usuário destinatário inválido')
    .toInt(),
  body('recipientSectorId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Setor destinatário inválido')
    .toInt(),
  body().custom((_, { req }) => {
    const parseId = (value) => {
      const raw = String(value ?? '').trim();
      if (!raw) return null;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1) return null;
      return parsed;
    };

    const recipientUserId = parseId(
      req.body.recipientUserId ??
      req.body.recipient_user_id ??
      req.body.recipientId ??
      req.body.recipient_id
    );

    const recipientSectorId = parseId(
      req.body.recipientSectorId ??
      req.body.recipient_sector_id
    );

    if (!recipientUserId && !recipientSectorId) {
      throw new Error('Destinatário é obrigatório');
    }

    if (recipientUserId) req.body.recipientUserId = recipientUserId;
    if (recipientSectorId) req.body.recipientSectorId = recipientSectorId;

    return true;
  })
];

const validateUpdateMessage = [
  applyBodyNormalizers,
  body('message').optional({ checkFalsy: true })
    .isLength({ max: 5000 }).withMessage('Mensagem muito longa'),
  body('status').optional({ checkFalsy: true })
    .custom((value) => {
      const v = normalizeStatus(value);
      if (v && ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    })
    .customSanitizer((value) => normalizeStatus(value)),
  body('recipientId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Destinatário inválido')
    .toInt(),
  body('recipientUserId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Usuário destinatário inválido')
    .toInt(),
  body('recipientSectorId').optional({ checkFalsy: true })
    .isInt({ min: 1 }).withMessage('Setor destinatário inválido')
    .toInt(),
  body('recipient').optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Destinatário muito longo'),
  body('recipientType').optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Tipo de destinatário inválido'),
  body('sender_email').optional({ checkFalsy: true })
    .isEmail().withMessage('Email inválido').normalizeEmail(),
  body('sender_phone').optional({ checkFalsy: true })
    .isLength({ max: 60 }).withMessage('Telefone inválido'),
  body('subject').optional({ checkFalsy: true })
    .isLength({ max: 255 }).withMessage('Assunto muito longo'),
  body('call_date').optional({ checkFalsy: true })
    .matches(dateRegex).withMessage('Data da chamada inválida (YYYY-MM-DD)'),
  body('call_time').optional({ checkFalsy: true })
    .isLength({ max: 10 }).withMessage('Horário inválido'),
  body('callback_time').optional({ checkFalsy: true })
    .isLength({ max: 30 }).withMessage('Horário de retorno inválido')
    ,
  body('visibility').optional({ checkFalsy: true })
    .custom((value) => {
      const v = String(value || '').trim().toLowerCase();
      if (v && v !== 'public' && v !== 'private') {
        throw new Error('Visibilidade inválida');
      }
      return true;
    })
    .customSanitizer((value) => String(value || '').trim().toLowerCase())
];

const validateUpdateStatus = [
  applyBodyNormalizers,
  body('status').notEmpty().withMessage('Status é obrigatório')
    .bail()
    .custom((value) => {
      const v = normalizeStatus(value);
      if (!v || ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    })
    .customSanitizer((value) => normalizeStatus(value))
];

const validateId = [
  param('id').notEmpty().withMessage('ID é obrigatório')
    .bail().isInt({ min: 1 }).withMessage('ID inválido').toInt()
];

const validateQueryMessages = [
  applyQueryNormalizers,
  query('limit').optional({ checkFalsy: true, nullable: true })
    .isInt({ min: 1, max: 50 }).withMessage('limit inválido').toInt()
    .customSanitizer((v) => (v && v >= 1 && v <= 50) ? v : 10),
  query('offset').optional({ checkFalsy: true, nullable: true })
    .isInt({ min: 0 }).withMessage('offset inválido').toInt()
    .customSanitizer((v) => (typeof v === 'number' && v >= 0) ? v : 0),
  query('status').optional({ checkFalsy: true, nullable: true })
    .customSanitizer((v) => normalizeStatus(v))
    .custom((v) => {
      if (!v) return true;
      if (ALLOWED_STATUS.indexOf(v) === -1) throw new Error('Status inválido');
      return true;
    }),
  query('recipient').optional({ checkFalsy: true, nullable: true })
    .isString().trim().isLength({ max: 255 }).withMessage('recipient muito longo'),
  query('q').optional({ checkFalsy: true, nullable: true })
    .isString().trim().isLength({ max: 200 }).withMessage('q inválido'),
  query('start_date').optional({ checkFalsy: true, nullable: true })
    .matches(dateRegex).withMessage('start_date inválida'),
  query('end_date').optional({ checkFalsy: true, nullable: true })
    .matches(dateRegex).withMessage('end_date inválida')
    .custom((value, meta) => {
      const req = (meta && meta.req) ? meta.req : {};
      const start = (req.query && req.query.start_date) ? req.query.start_date : null;
      if (value && start && value < start) throw new Error('end_date deve ser igual ou posterior a start_date');
      return true;
    }),
  query('order_by').optional({ checkFalsy: true, nullable: true })
    .isIn(['created_at', 'updated_at', 'status']).withMessage('order_by inválido')
    .customSanitizer((v) => v || 'created_at'),
  query('order').optional({ checkFalsy: true, nullable: true })
    .customSanitizer((v) => (String(v || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc'))
];

// -----------------------------
// Validators de Users (Admin)
// -----------------------------
const vbody = expressValidator.body;
const ALLOWED_ROLES = ['ADMIN', 'SUPERVISOR', 'OPERADOR', 'LEITOR'];

const allowedViewScopes = ['own', 'all'];

const validateUserCreate = [
  vbody('name').notEmpty().withMessage('Nome é obrigatório')
    .isLength({ max: 255 }).withMessage('Nome muito longo'),
  vbody('email').notEmpty().withMessage('E-mail é obrigatório')
    .isEmail().withMessage('E-mail inválido').normalizeEmail(),
  vbody('password').notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 8, max: 255 }).withMessage('Senha deve ter pelo menos 8 caracteres'),
  vbody('role').optional({ checkFalsy: true })
    .custom((r) => ALLOWED_ROLES.includes(String(r).toUpperCase()))
    .withMessage('Papel (role) inválido'),
  vbody('active').optional({ nullable: true })
    .isBoolean().withMessage('Status inválido para ativo')
    .toBoolean(),
  vbody('viewScope').optional({ checkFalsy: true, nullable: true })
    .custom((value) => allowedViewScopes.includes(String(value || '').toLowerCase()))
    .withMessage('Escopo de visualização inválido')
    .customSanitizer((value) => String(value || '').toLowerCase()),
  vbody('view_scope').optional({ checkFalsy: true, nullable: true })
    .custom((value) => allowedViewScopes.includes(String(value || '').toLowerCase()))
    .withMessage('Escopo de visualização inválido')
    .customSanitizer((value) => String(value || '').toLowerCase()),
  vbody('sectorIds').isArray({ min: 1 }).withMessage('Selecione pelo menos um setor'),
  vbody('sectorIds.*').isInt({ min: 1 }).withMessage('IDs de setor inválidos')
];

const validateUserUpdate = [
  vbody('name').optional({ nullable: true })
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ max: 255 }).withMessage('Nome muito longo'),
  vbody('email').optional({ nullable: true })
    .notEmpty().withMessage('E-mail é obrigatório')
    .isEmail().withMessage('E-mail inválido').normalizeEmail(),
  vbody('role').optional({ nullable: true })
    .notEmpty().withMessage('Papel (role) é obrigatório')
    .custom((r) => ALLOWED_ROLES.includes(String(r).toUpperCase()))
    .withMessage('Papel (role) inválido'),
  vbody('active').optional({ nullable: true })
    .isBoolean().withMessage('Status inválido para ativo')
    .toBoolean(),
  vbody('viewScope').optional({ checkFalsy: true, nullable: true })
    .custom((value) => allowedViewScopes.includes(String(value || '').toLowerCase()))
    .withMessage('Escopo de visualização inválido')
    .customSanitizer((value) => String(value || '').toLowerCase()),
  vbody('view_scope').optional({ checkFalsy: true, nullable: true })
    .custom((value) => allowedViewScopes.includes(String(value || '').toLowerCase()))
    .withMessage('Escopo de visualização inválido')
    .customSanitizer((value) => String(value || '').toLowerCase())
];

const validateUserStatus = [
  vbody('active').exists().withMessage('Status ativo é obrigatório')
    .isBoolean().withMessage('Status inválido para ativo')
    .toBoolean(),
];

const validateUserPassword = [
  vbody('password').notEmpty().withMessage('Senha é obrigatória')
    .isLength({ min: 8, max: 255 }).withMessage('Senha deve ter pelo menos 8 caracteres')
    .matches(/[A-Za-z]/).withMessage('Senha deve conter letras')
    .matches(/[0-9]/).withMessage('Senha deve conter números'),
];

const validatePasswordResetRequest = [
  body('email').trim().isEmail().withMessage('E-mail inválido').normalizeEmail(),
];

const validatePasswordResetSubmit = [
  body('token').trim().notEmpty().withMessage('Token é obrigatório'),
  body('password').trim().isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres'),
  body('confirm').trim().notEmpty().withMessage('Confirmação é obrigatória'),
];

const validateAccountPasswordChange = [
  body('currentPassword').trim().notEmpty().withMessage('Informe a senha atual.'),
  body('newPassword').trim().isLength({ min: 8 }).withMessage('A nova senha deve ter pelo menos 8 caracteres.'),
  body('confirmPassword').trim().notEmpty().withMessage('Confirme a nova senha.'),
];

// -------------------------------------------------------------
// Exports unificados
// -------------------------------------------------------------
module.exports = {
  // helpers
  handleValidationErrors,
  validateId,
  validateQueryMessages,
  normalizeStatus,

  // messages
  validateCreateMessage,
  validateForwardMessage,
  validateUpdateMessage,
  validateUpdateStatus,

  // aliases
  handleValidation: handleValidationErrors,
  validateListMessages: validateQueryMessages,
  validateIdParam: validateId,

  // users
  validateUserCreate,
  validateUserUpdate,
  validateUserStatus,
  validateUserPassword,
  validatePasswordResetRequest,
  validatePasswordResetSubmit,
  validateAccountPasswordChange,
};
