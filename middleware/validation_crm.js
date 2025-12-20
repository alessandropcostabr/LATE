// middleware/validation_crm.js
// Validadores específicos do CRM.

const { body, query, param } = require('express-validator');

const validateUUID = (field) => body(field).isUUID().withMessage(`${field} deve ser UUID`);
const validateUUIDParam = (field) => param(field).isUUID().withMessage(`${field} deve ser UUID`);
const limitRule = query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('limit deve estar entre 1 e 500');
const offsetRule = query('offset').optional().isInt({ min: 0 }).withMessage('offset deve ser >= 0');

const requireTitle = body('title').notEmpty().withMessage('Título é obrigatório');

const validateLeadCreate = [
  body('phone').optional().isString(),
  body('email').optional().isEmail().withMessage('E-mail inválido'),
  body('pipeline_id').optional().isUUID().withMessage('pipeline_id deve ser UUID'),
  body('status').optional().isString(),
  body('score').optional().isInt({ min: 0 }),
  body('notes').optional().isString(),
  body().custom((val) => {
    const phone = val.phone?.trim();
    const email = val.email?.trim();
    if (!phone && !email) {
      throw new Error('Informe telefone ou e-mail do lead');
    }
    return true;
  }),
];

const validateLeadList = [limitRule, offsetRule,
  query('pipeline_id').optional().isUUID(),
  query('owner_id').optional().isInt({ min: 1 }),
  query('status').optional().isString(),
  query('search').optional().isString(),
  query('scope').optional().isIn(['me', 'team', 'all']).withMessage('scope inválido'),
];

const validateOpportunityCreate = [
  requireTitle,
  body('pipeline_id').isUUID().withMessage('pipeline_id é obrigatório e deve ser UUID'),
  body('stage_id').isUUID().withMessage('stage_id é obrigatório e deve ser UUID'),
  body('amount').optional().isNumeric().withMessage('amount deve ser numérico'),
  body('contact_id').optional().isUUID(),
  body('account_id').optional().isUUID(),
  body('close_date').optional().isISO8601().withMessage('close_date deve ser data ISO'),
  body().custom((val) => {
    const hasContactId = !!val.contact_id;
    const hasContactData = (val.phone || val.email);
    if (!hasContactId && !hasContactData) {
      throw new Error('Informe contact_id ou dados de contato (telefone/e-mail)');
    }
    return true;
  }),
];

const validateOpportunityList = [limitRule, offsetRule,
  query('pipeline_id').optional().isUUID(),
  query('stage_id').optional().isUUID(),
  query('owner_id').optional().isInt({ min: 1 }),
  query('contact_id').optional().isUUID(),
  query('search').optional().isString(),
  query('scope').optional().isIn(['me', 'team', 'all']).withMessage('scope inválido'),
];

const validateOpportunityMove = [
  validateUUIDParam('id'),
  body('stage_id').isUUID().withMessage('stage_id é obrigatório e deve ser UUID'),
];

const validateActivityCreate = [
  body('type').optional().isIn(['task', 'meeting', 'call']).withMessage('type inválido'),
  body('subject').notEmpty().withMessage('Assunto é obrigatório'),
  body('starts_at').optional().isISO8601(),
  body('ends_at').optional().isISO8601(),
  body('related_type').optional().isIn(['lead', 'contact', 'account', 'opportunity']).withMessage('related_type inválido'),
  body('related_id').optional().isUUID(),
  body('status').optional().isString(),
];

const validateActivityList = [
  query('related_type').optional().isIn(['lead', 'contact', 'account', 'opportunity']),
  query('related_id').optional().isUUID(),
  query('scope').optional().isIn(['me', 'team', 'all']).withMessage('scope inválido'),
];

// Custom fields
const validateCustomFieldCreate = [
  body('entity').isIn(['lead','contact','account','opportunity','activity']).withMessage('entity inválido'),
  body('name').notEmpty().withMessage('name é obrigatório'),
  body('type').notEmpty().withMessage('type é obrigatório'),
  body('options').optional().isArray().withMessage('options deve ser array'),
  body('required').optional().isBoolean(),
  body('position').optional().isInt(),
];

const validateCustomFieldUpdate = [
  validateUUIDParam('id'),
  body('name').optional().isString(),
  body('type').optional().isString(),
  body('options').optional().isArray(),
  body('required').optional().isBoolean(),
  body('position').optional().isInt(),
];


const validateCsvImport = [
  body('csv').isString().withMessage('csv é obrigatório'),
  body('pipeline_id').optional().isUUID().withMessage('pipeline_id deve ser UUID'),
];


const validateStageConfigUpdate = [
  validateUUIDParam('id'),
  body('name').optional().isString(),
  body('position').optional().isInt({ min: 1 }),
  body('probability').optional().isFloat({ min: 0, max: 1 }),
  body('color').optional().isString(),
  body('sla_minutes').optional().isInt({ min: 0 }),
];

const validateStageRuleUpdate = [
  validateUUIDParam('id'),
  body('required_fields').optional().isArray(),
  body('forbid_jump').optional().isBoolean(),
  body('forbid_back').optional().isBoolean(),
  body('auto_actions').optional().isArray(),
];

const validateDedupPreview = [
  body('phone').optional().isString(),
  body('email').optional().isEmail().withMessage('email inválido'),
  body().custom((val) => { if (!val.phone && !val.email) throw new Error('Informe telefone ou email'); return true; }),
];

const validateDedupMerge = [
  body('source_id').notEmpty().withMessage('source_id é obrigatório'),
  body('target_id').notEmpty().withMessage('target_id é obrigatório'),
  body().custom((val) => { if (val.source_id === val.target_id) throw new Error('IDs devem ser diferentes'); return true; }),
];

const validateCustomFieldValue = [
  validateUUIDParam('id'),
  body('entity_type').isIn(['lead','contact','account','opportunity','activity']).withMessage('entity_type inválido'),
  body('entity_id').isUUID().withMessage('entity_id deve ser UUID'),
  body('value').not().isEmpty().withMessage('value é obrigatório'),
];

const validateCustomFieldValuesList = [
  query('entity_type').isIn(['lead','contact','account','opportunity','activity']).withMessage('entity_type inválido'),
  query('entity_id').isUUID().withMessage('entity_id deve ser UUID'),
];

module.exports = {
  validateLeadCreate,
  validateLeadList,
  validateOpportunityCreate,
  validateOpportunityList,
  validateOpportunityMove,
  validateActivityCreate,
  validateActivityList,
  validateCustomFieldCreate,
  validateCustomFieldUpdate,
  validateCustomFieldValue,
  validateCustomFieldValuesList,
  validateCsvImport,
  validateStageConfigUpdate,
  validateStageRuleUpdate,
  validateDedupPreview,
  validateDedupMerge,
};
