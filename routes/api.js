// routes/api.js
// Comentários em pt-BR; identificadores em inglês.

const Router = require('router');
const rateLimit = require('express-rate-limit');
const router = Router();

// Controllers existentes
const messageController = require('../controllers/messageController');
const statsController   = require('../controllers/statsController');
const passwordController = require('../controllers/passwordController');
const messageLabelController = require('../controllers/messageLabelController');
const messageChecklistController = require('../controllers/messageChecklistController');
const messageCommentController = require('../controllers/messageCommentController');
const messageWatcherController = require('../controllers/messageWatcherController');
const automationController = require('../controllers/automationController');
const eventLogsController = require('../controllers/eventLogsController');
const healthController = require('../controllers/healthController');
const metaController = require('../controllers/metaController');
const intakeController = require('../controllers/intakeController');
const reportExportController = require('../controllers/reportExportController');
const statusController = require('../controllers/statusController');
const whoamiController = require('../controllers/whoamiController');
const callLogController = require('../controllers/callLogController');
const crmController = require('../controllers/crmController');
const incidentController = require('../controllers/incidentController');
const customFieldController = require('../controllers/customFieldController');
const recadoSyncController = require('../controllers/recadoSyncController');
const dedupController = require('../controllers/dedupController');
const messageSendEventController = require('../controllers/messageSendEventController');
const crmStatsController = require('../controllers/crmStatsController');
const { collectDevInfo } = require('../utils/devInfo');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// Validation (NOMES DEVEM BATER com middleware/validation.js)
const validation = require('../middleware/validation');
const {
  handleValidationErrors,
  handleIntakeValidationErrors,
  validateCreateMessage,
  validateForwardMessage,
  validateUpdateMessage,
  validateUpdateStatus,
  validateId,
  validateQueryMessages,
  validatePasswordResetRequest,
  validatePasswordResetSubmit,
  validateAccountPasswordChange,
  validateMessageLabel,
  validateMessageLabelsReplace,
  validateChecklistCreate,
  validateChecklistUpdate,
  validateChecklistItemCreate,
  validateChecklistItemUpdate,
  validateChecklistIdParam,
  validateChecklistItemIdParam,
  validateCommentCreate,
  validateWatcherAdd,
  validateWatcherUserParam,
  validateAutomationCreate,
  validateAutomationUpdate,
  validateAutomationToggle,
  validateAutomationIdParam,
  validateCommentIdParam,
  validateIntakeCreate,
  validateRelatedMessagesQuery,
  validateUserCreate,
  validateUserUpdate,
  validateUserStatus,
  validateUserPassword,
  validateIdParam,
} = validation;
const {
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
  validateCsvImport,
  validateStageConfigUpdate,
  validateStageRuleUpdate,
  validateDedupPreview,
  validateDedupMerge,
} = require('../middleware/validation_crm');

// Painel ADMIN de Usuários
const {
  requireAuth,
  requireRole,
  requirePermission,
  requireMessageUpdatePermission,
} = require('../middleware/auth');
const UserController = require('../controllers/userController');

// --------- Admin: Setores ---------
const sectorController = require('../controllers/sectorController');

// --- Helper defensivo para middlewares vindos de fontes diversas ---
function flatFns(...mws) {
  const result = [];
  const warnings = [];

  function pushWarning(message) {
    warnings.push(message);
  }

  function visit(node, path) {
    const location = path || '<root>';

    if (node == null) {
      pushWarning(`[router] Middleware ausente em ${location} (valor=${node})`);
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((child, index) => visit(child, path ? `${path}[${index}]` : `[${index}]`));
      return;
    }

    if (typeof node === 'function') {
      result.push(node);
      return;
    }

    const type = Object.prototype.toString.call(node);
    pushWarning(`[router] Ignorando middleware inválido em ${location} (tipo=${type})`);
  }

  mws.forEach((mw, index) => visit(mw, `arg#${index + 1}`));

  const fallbackMessages = () => (
    warnings.length
      ? warnings.slice()
      : [
          `[router] Nenhum middleware válido fornecido (origens: ${
            mws.length ? mws.map((_, index) => `arg#${index + 1}`).join(', ') : '<nenhuma>'
          })`
        ]
  );

  const logWarnings = (req, res, next) => {
    fallbackMessages().forEach((message) => console.warn(message));
    next();
  };

  if (result.length === 0) {
    result.push(logWarnings);
  } else if (warnings.length) {
    result.push(logWarnings);
  }

  return result;
}

const csrfProtection = require('../middleware/csrf');

const canReadMessages = [requireAuth, requirePermission('read')];
const canCreateMessages = [requireAuth, requirePermission('create'), csrfProtection];
const canUpdateMessages = [requireAuth, requirePermission('update'), csrfProtection];
const canManageMessageAccess = [requireAuth, requireMessageUpdatePermission, csrfProtection];
const canDeleteMessages = [requireAuth, requirePermission('delete'), csrfProtection];
const canChangeOwnPassword = [requireAuth, csrfProtection];
const canAudit = [requireAuth, requireRole('ADMIN', 'SUPERVISOR')];
const canReadCRM = [requireAuth, requirePermission('read')];
const canCreateCRM = [requireAuth, requirePermission('create'), csrfProtection];
const canUpdateCRM = [requireAuth, requirePermission('update'), csrfProtection];

const intakeLimiter = rateLimit({
  windowMs: Number(process.env.INTAKE_RATE_WINDOW_MS || 60 * 1000),
  max: Number(process.env.INTAKE_RATE_LIMIT || 20),
  standardHeaders: true,
  legacyHeaders: false,
});
const intakeRequiresCsrf = String(process.env.INTAKE_REQUIRE_CSRF || '').trim() === '1';
const intakeGuards = intakeRequiresCsrf ? [intakeLimiter, csrfProtection] : [intakeLimiter];

// CSRF refresh para clientes não autenticados (ex.: tela de login)
router.get('/csrf', csrfProtection, (req, res) => {
  try {
    const token = typeof req.csrfToken === 'function' ? req.csrfToken() : null;
    if (!token) {
      return res.status(500).json({ success: false, error: 'Falha ao gerar token CSRF' });
    }
    return res.json({ success: true, data: { token } });
  } catch (err) {
    console.error('[csrf] erro ao gerar token:', err);
    return res.status(500).json({ success: false, error: 'Falha ao gerar token CSRF' });
  }
});

// Utilitários
router.get('/health', healthController.getHealth);
router.get('/version', metaController.version);
router.get(
  '/status',
  ...flatFns(requireAuth, requireRole('ADMIN', 'SUPERVISOR')),
  statusController.getStatus
);
router.get(
  '/whoami',
  ...flatFns(requireAuth),
  whoamiController.get
);
router.post(
  '/report-incident',
  incidentController.report
);

// Call logs
router.get(
  '/call-logs',
  ...flatFns(requireAuth, requirePermission('read')),
  callLogController.list
);

// CRM: pipelines, leads e oportunidades
router.get(
  '/crm/pipelines',
  ...flatFns(canReadCRM),
  crmController.listPipelines
);
router.get(
  '/crm/leads',
  ...flatFns(canReadCRM, validateLeadList, handleValidationErrors),
  crmController.listLeads
);
router.get(
  '/crm/opportunities',
  ...flatFns(canReadCRM, validateOpportunityList, handleValidationErrors),
  crmController.listOpportunities
);
router.post(
  '/crm/leads',
  ...flatFns(canCreateCRM, validateLeadCreate, handleValidationErrors),
  crmController.createLead
);
router.post(
  '/crm/opportunities',
  ...flatFns(canCreateCRM, validateOpportunityCreate, handleValidationErrors),
  crmController.createOpportunity
);
router.patch(
  '/crm/opportunities/:id/stage',
  ...flatFns(canUpdateCRM, validateOpportunityMove, handleValidationErrors),
  crmController.moveOpportunityStage
);
router.post(
  '/crm/activities',
  ...flatFns(canCreateCRM, validateActivityCreate, handleValidationErrors),
  crmController.createActivity
);
router.get(
  '/crm/activities',
  ...flatFns(canReadCRM, validateScopeParam(), validateActivityList, handleValidationErrors),
  crmController.listActivities
);
router.patch(
  '/crm/activities/:id/status',
  ...flatFns(canUpdateCRM, handleValidationErrors),
  crmController.updateActivityStatus
);
router.get(
  '/crm/activities.ics',
  ...flatFns(canReadCRM),
  crmController.exportActivitiesICS
);
router.get(
  '/crm/stats',
  ...flatFns(canReadCRM, validateScopeParam()),
  crmStatsController.list,
);
router.get(
  '/crm/leads.csv',
  ...flatFns(canReadCRM),
  crmController.exportLeadsCsv
);
router.get(
  '/crm/opportunities.csv',
  ...flatFns(canReadCRM),
  crmController.exportOpportunitiesCsv
);
router.post(
  '/crm/leads/preview-csv',
  ...flatFns(canUpdateCRM, validateCsvImport, handleValidationErrors),
  crmController.previewLeadsCsv
);
router.post(
  '/crm/leads/import-csv',
  ...flatFns(canUpdateCRM, validateCsvImport, handleValidationErrors),
  crmController.importLeadsCsv
);
router.patch(
  '/crm/stages/:id/config',
  ...flatFns(canUpdateCRM, validateStageConfigUpdate, handleValidationErrors),
  crmController.updateStageConfig
);
router.patch(
  '/crm/stages/:id/rule',
  ...flatFns(canUpdateCRM, validateStageRuleUpdate, handleValidationErrors),
  crmController.updateStageRule
);
router.get(
  '/crm/stats/pipeline',
  ...flatFns(canReadCRM),
  crmController.statsPipeline
);
router.get(
  '/crm/stats/activities',
  ...flatFns(canReadCRM),
  crmController.statsActivities
);
router.post(
  '/crm/stats/refresh',
  ...flatFns(canAudit),
  crmController.refreshStats
);
router.get(
  '/crm/custom-fields',
  ...flatFns(canReadCRM),
  customFieldController.list
);

router.get(
  '/crm/dedupe/contacts',
  ...flatFns(canUpdateCRM),
  dedupController.listDuplicates
);
router.post(
  '/crm/dedupe/contacts/preview',
  ...flatFns(canUpdateCRM, validateDedupPreview, handleValidationErrors),
  dedupController.previewMerge
);
router.post(
  '/crm/dedupe/contacts/merge',
  ...flatFns(canUpdateCRM, validateDedupMerge, handleValidationErrors),
  dedupController.merge
);
router.post(
  '/crm/custom-fields',
  ...flatFns(canUpdateCRM, validateCustomFieldCreate, handleValidationErrors),
  customFieldController.create
);
router.patch(
  '/crm/custom-fields/:id',
  ...flatFns(canUpdateCRM, validateCustomFieldUpdate, handleValidationErrors),
  customFieldController.update
);
router.delete(
  '/crm/custom-fields/:id',
  ...flatFns(canUpdateCRM, handleValidationErrors),
  customFieldController.remove
);
router.put(
  '/crm/custom-fields/:id/value',
  ...flatFns(canUpdateCRM, validateCustomFieldValue, handleValidationErrors),
  customFieldController.upsertValue
);
router.post(
  '/crm/sync/recados',
  ...flatFns(requireAuth, requireRole('ADMIN'), csrfProtection),
  recadoSyncController.sync
);

router.get(
  '/crm/stats/pipeline',
  ...flatFns(canReadCRM),
  crmController.statsPipeline
);
router.get(
  '/crm/stats/activities',
  ...flatFns(canReadCRM),
  crmController.statsActivities
);
router.get(
  '/crm/custom-fields',
  ...flatFns(canReadCRM),
  customFieldController.list
);
router.post(
  '/crm/custom-fields',
  ...flatFns(canUpdateCRM, validateCustomFieldCreate, handleValidationErrors),
  customFieldController.create
);
router.patch(
  '/crm/custom-fields/:id',
  ...flatFns(canUpdateCRM, validateCustomFieldUpdate, handleValidationErrors),
  customFieldController.update
);
router.delete(
  '/crm/custom-fields/:id',
  ...flatFns(canUpdateCRM, handleValidationErrors),
  customFieldController.remove
);
router.put(
  '/crm/custom-fields/:id/value',
  ...flatFns(canUpdateCRM, validateCustomFieldValue, handleValidationErrors),
  customFieldController.upsertValue
);
router.post(
  '/crm/sync/recados',
  ...flatFns(requireAuth, requireRole('ADMIN'), csrfProtection),
  recadoSyncController.sync
);


const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
if (nodeEnv === 'development' || nodeEnv === 'test') {
  router.get(
    '/debug/info',
    ...flatFns(requireAuth),
    async (req, res) => {
      try {
        const info = await collectDevInfo();
        return res.json({ success: true, data: info });
      } catch (err) {
        console.error('[debug/info] falha ao coletar diagnóstico:', err);
        return res.status(500).json({ success: false, error: 'Falha ao coletar diagnóstico' });
      }
    }
  );
}

router.post(
  '/intake',
  ...flatFns(intakeGuards, validateIntakeCreate, handleIntakeValidationErrors),
  intakeController.create
);

// Auditoria (event logs)
router.get(
  '/event-logs',
  ...flatFns(canAudit),
  eventLogsController.list
);

router.get(
  '/event-logs/summary',
  ...flatFns(canAudit),
  eventLogsController.summary
);

router.get(
  '/event-logs/:id',
  ...flatFns(canAudit),
  eventLogsController.getById
);

router.post(
  '/event-logs/export',
  ...flatFns(canAudit, csrfProtection),
  reportExportController.requestEventLogsExport
);

router.post(
  '/messages/export',
  ...flatFns(canAudit, csrfProtection),
  reportExportController.requestMessagesExport
);

router.get(
  '/report-exports',
  ...flatFns(canAudit),
  reportExportController.list
);

router.get(
  '/report-exports/:id/download',
  ...flatFns(canAudit),
  reportExportController.download
);

// ========== Messages ==========
router.get(
  '/messages',
  ...flatFns(canReadMessages, validateQueryMessages, handleValidationErrors),
  messageController.list
);

router.get('/messages/stats', ...flatFns(canReadMessages, statsController.messagesStats));

router.get(
  '/messages/related',
  ...flatFns(canReadMessages, validateRelatedMessagesQuery, handleValidationErrors),
  messageController.listRelated
);

router.get(
  '/messages/:id',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageController.getById
);

router.post(
  '/messages',
  ...flatFns(canCreateMessages, validateCreateMessage, handleValidationErrors),
  messageController.create
);

router.put(
  '/messages/:id',
  ...flatFns(
    [requireAuth, csrfProtection],
    validateId,
    validateUpdateMessage,
    handleValidationErrors,
    [requireMessageUpdatePermission]
  ),
  messageController.update
);

router.post(
  '/messages/:id/forward',
  ...flatFns(canUpdateMessages, validateId, validateForwardMessage, handleValidationErrors),
  messageController.forward
);

router.patch(
  '/messages/:id/status',
  ...flatFns(
    [requireAuth, csrfProtection],
    validateId,
    validateUpdateStatus,
    handleValidationErrors,
    [requireMessageUpdatePermission]
  ),
  messageController.updateStatus
);

router.delete(
  '/messages/:id',
  ...flatFns(canDeleteMessages, validateId, handleValidationErrors),
  messageController.remove
);

// ---- Labels ----
router.get(
  '/messages/:id/labels',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageLabelController.list
);

router.post(
  '/messages/:id/labels',
  ...flatFns(canUpdateMessages, validateId, validateMessageLabel, handleValidationErrors),
  messageLabelController.add
);

router.put(
  '/messages/:id/labels',
  ...flatFns(canUpdateMessages, validateId, validateMessageLabelsReplace, handleValidationErrors),
  messageLabelController.replace
);

router.delete(
  '/messages/:id/labels/:label',
  ...flatFns(canUpdateMessages, validateId, handleValidationErrors),
  messageLabelController.remove
);

// ---- Checklists ----
router.get(
  '/messages/:id/checklists',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageChecklistController.list
);

router.post(
  '/messages/:id/checklists',
  ...flatFns(canUpdateMessages, validateId, validateChecklistCreate, handleValidationErrors),
  messageChecklistController.create
);

router.put(
  '/messages/:id/checklists/:checklistId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistUpdate, handleValidationErrors),
  messageChecklistController.update
);

router.delete(
  '/messages/:id/checklists/:checklistId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, handleValidationErrors),
  messageChecklistController.remove
);

router.get(
  '/messages/:id/checklists/:checklistId/items',
  ...flatFns(canReadMessages, validateId, validateChecklistIdParam, handleValidationErrors),
  messageChecklistController.listItems
);

router.post(
  '/messages/:id/checklists/:checklistId/items',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistItemCreate, handleValidationErrors),
  messageChecklistController.createItem
);

router.put(
  '/messages/:id/checklists/:checklistId/items/:itemId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistItemIdParam, validateChecklistItemUpdate, handleValidationErrors),
  messageChecklistController.updateItem
);

router.delete(
  '/messages/:id/checklists/:checklistId/items/:itemId',
  ...flatFns(canUpdateMessages, validateId, validateChecklistIdParam, validateChecklistItemIdParam, handleValidationErrors),
  messageChecklistController.removeItem
);

// ---- Comentários ----
router.get(
  '/messages/:id/comments',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageCommentController.list
);

router.post(
  '/messages/:id/comments',
  ...flatFns(canManageMessageAccess, validateId, validateCommentCreate, handleValidationErrors),
  messageCommentController.create
);

router.delete(
  '/messages/:id/comments/:commentId',
  ...flatFns(canManageMessageAccess, validateId, validateCommentIdParam, handleValidationErrors),
  messageCommentController.remove
);

// ---- Watchers ----
router.get(
  '/messages/:id/watchers',
  ...flatFns(canReadMessages, validateId, handleValidationErrors),
  messageWatcherController.list
);

router.post(
  '/messages/:id/watchers',
  ...flatFns(canUpdateMessages, validateId, validateWatcherAdd, handleValidationErrors),
  messageWatcherController.add
);

router.delete(
  '/messages/:id/watchers/:userId',
  ...flatFns(canUpdateMessages, validateId, validateWatcherUserParam, handleValidationErrors),
  messageWatcherController.remove
);

// ========== Account Password ==========
router.post(
  '/account/password',
  ...flatFns(canChangeOwnPassword, validateAccountPasswordChange, handleValidationErrors),
  passwordController.changePassword
);

// ========== Password Recovery ==========
router.post(
  '/password/recover',
  ...flatFns(csrfProtection, validatePasswordResetRequest, handleValidationErrors),
  passwordController.requestReset
);

router.post(
  '/password/reset',
  ...flatFns(csrfProtection, validatePasswordResetSubmit, handleValidationErrors),
  passwordController.resetWithToken
);

// ========== Automations ==========
router.get(
  '/automations',
  ...flatFns([requireRole('ADMIN')]),
  automationController.list
);

router.get(
  '/automations/:id',
  ...flatFns([requireRole('ADMIN')], validateAutomationIdParam, handleValidationErrors),
  automationController.get
);

router.get(
  '/automations/:id/logs',
  ...flatFns([requireRole('ADMIN')], validateAutomationIdParam, handleValidationErrors),
  automationController.listLogs
);

router.post(
  '/automations',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationCreate, handleValidationErrors),
  automationController.create
);

router.put(
  '/automations/:id',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationIdParam, validateAutomationUpdate, handleValidationErrors),
  automationController.update
);

router.patch(
  '/automations/:id/toggle',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationIdParam, validateAutomationToggle, handleValidationErrors),
  automationController.toggle
);

router.delete(
  '/automations/:id',
  ...flatFns([requireRole('ADMIN')], csrfProtection, validateAutomationIdParam, handleValidationErrors),
  automationController.remove
);

// ========== Stats (Relatórios) ==========
router.get('/stats/by-status',    ...flatFns(canReadMessages, statsController.byStatus));
router.get('/stats/by-recipient', ...flatFns(canReadMessages, statsController.byRecipient));
router.get('/stats/by-month',     ...flatFns(canReadMessages, statsController.byMonth));

// ========== Admin - Users ==========
// GET /api/users?role=ADMIN&status=active&q=Fulano
router.get('/users',
  requireRole('ADMIN'),
  UserController.list
);

router.get('/users/:id',
  requireRole('ADMIN'),
  validateIdParam,
  handleValidationErrors,
  UserController.getById
);

router.post('/users',
  requireRole('ADMIN'),
  validateUserCreate,
  handleValidationErrors,
  UserController.create
);

router.put('/users/:id',
  requireRole('ADMIN'),
  validateIdParam,
  validateUserUpdate,
  handleValidationErrors,
  UserController.update
);

router.put('/users/:id/status',
  requireRole('ADMIN'),
  validateIdParam,
  validateUserStatus,
  handleValidationErrors,
  UserController.updateStatus
);

router.put('/users/:id/password',
  requireRole('ADMIN'),
  validateIdParam,
  validateUserPassword,
  handleValidationErrors,
  UserController.resetPassword
);

router.delete('/users/:id',
  requireRole('ADMIN'),
  validateIdParam,
  handleValidationErrors,
  UserController.remove
);

// ========== Admin - Sectors ==========
// GET /api/sectors?status=active&q=Setor
router.get('/sectors',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateList),
  sectorController.list
);

router.post('/sectors',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateCreate),
  sectorController.create
);

router.put('/sectors/:id',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateUpdate),
  sectorController.update
);

router.put('/sectors/:id/toggle',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateToggle),
  sectorController.toggle
);

router.delete('/sectors/:id',
  requireRole('ADMIN'),
  sectorController.remove
);

// ========== Admin - User ↔ Sectors ==========
router.get('/users/:id/sectors',
  requireRole('ADMIN'),
  sectorController.getUserSectors
);

router.put('/users/:id/sectors',
  requireRole('ADMIN'),
  ...flatFns(sectorController.validateUserSectors),
  sectorController.setUserSectors
);

// Integrations: Message Send Events (Sender)
router.post('/message-events',
  apiKeyAuth,
  messageSendEventController.createApi
);

router.get('/message-events',
  requireAuth,
  requireRole('ADMIN', 'SUPERVISOR'),
  messageSendEventController.listApi
);

// Export
module.exports = router;
