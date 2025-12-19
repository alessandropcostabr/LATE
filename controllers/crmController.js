// controllers/crmController.js
// CRM: pipelines, leads, oportunidades, atividades, stats e utilitários (ICS/CSV).

const fs = require('fs');
const { formidable } = require('formidable');
const PipelineModel = require('../models/pipeline');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const ActivityModel = require('../models/activity');
const ContactModel = require('../models/contact');
const CrmStats = require('../models/crmStats');
const CustomFieldModel = require('../models/customField');
const CustomFieldValueModel = require('../models/customFieldValue');
const CrmImportService = require('../services/crmImportService');
const { normalizePhone } = require('../utils/phone');
const { normalizeEmail } = require('../utils/normalizeContact');
const { applyOwnerScope } = require('../utils/scope');

const UUID_RE = /^[0-9a-fA-F-]{36}$/;
function isUuid(val) { return UUID_RE.test(String(val || '')); }

function isPrivileged(role) {
  const value = String(role || '').toUpperCase();
  return value === 'ADMIN' || value === 'SUPERVISOR';
}

function resolveViewScope(req) {
  return String(req.session?.user?.view_scope || 'all').toLowerCase();
}

function normalizeContactInput(body = {}) {
  const name = (body.name || body.contact_name || '').trim();
  const email = normalizeEmail(body.email || body.contact_email || null);
  const phoneRaw = body.phone || body.contact_phone || body.mobile || body.contact_mobile;
  const phoneNormalized = normalizePhone(phoneRaw || '');
  return {
    name: name || null,
    email,
    phone: phoneRaw || null,
    phone_normalized: phoneNormalized || '',
    email_normalized: email || '',
  };
}

function combineData(existing = {}, incoming = {}) {
  return { ...existing, ...incoming };
}

function resolveCustomValue(identifier, customInput = {}, existingValues = []) {
  if (!identifier) return undefined;
  const key = String(identifier).toLowerCase();
  if (customInput && typeof customInput === 'object') {
    if (identifier in customInput) return customInput[identifier];
    const foundKey = Object.keys(customInput).find((k) => String(k).toLowerCase() === key);
    if (foundKey) return customInput[foundKey];
  }
  const found = existingValues.find((v) => v.field_id === identifier || String(v.name || '').toLowerCase() === key);
  return found ? found.value : undefined;
}

function checkRequiredFields(rule = {}, data = {}, customInput = {}, existingCustomValues = []) {
  const required = Array.isArray(rule.required_fields) ? rule.required_fields : [];
  const missing = [];
  required.forEach((field) => {
    if (String(field).startsWith('custom:')) {
      const ident = String(field).slice(7);
      const val = resolveCustomValue(ident, customInput, existingCustomValues);
      if (val === undefined || val === null || val === '') missing.push(`custom:${ident}`);
      return;
    }
    const value = data[field];
    if (value === undefined || value === null || value === '') missing.push(field);
  });
  return missing;
}

async function scheduleStageSla(stage, opportunity) {
  if (!stage || !stage.sla_minutes) return;
  const minutes = Number(stage.sla_minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  const start = new Date();
  const end = new Date(start.getTime() + minutes * 60000);
  try {
    await ActivityModel.createActivity({
      type: 'task',
      subject: `SLA ${stage.name || ''}`.trim(),
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      owner_id: opportunity.owner_id,
      related_type: 'opportunity',
      related_id: opportunity.id,
      status: 'pending',
      location: null,
    });
  } catch (err) {
    console.error('[crm][sla] falha ao criar atividade SLA', err);
  }
}

async function applyAutoActions(stage, opportunity) {
  const actions = Array.isArray(stage.auto_actions) ? stage.auto_actions : [];
  if (!actions.length) return;
  for (const action of actions) {
    const type = String(action.type || '').toLowerCase();
    try {
      if (type === 'create_activity') {
        await ActivityModel.createActivity({
          type: action.activity_type || 'task',
          subject: action.subject || `Tarefa para ${opportunity.title}`,
          starts_at: action.starts_at || null,
          ends_at: action.ends_at || null,
          owner_id: opportunity.owner_id,
          related_type: 'opportunity',
          related_id: opportunity.id,
          status: 'pending',
          location: null,
        });
      } else if (type === 'notify_owner') {
        console.info('[crm][auto_action] notify_owner', opportunity.id);
      } else if (type === 'set_probability') {
        if (action.value !== undefined && action.value !== null) {
          await OpportunityModel.updateProbability(opportunity.id, action.value);
        }
      }
    } catch (err) {
      console.error('[crm][auto_action] falha', action, err);
    }
  }
}

async function validateOpportunityRequired({ stage, payload, customInput, existingCustomValues }) {
  const missing = [];
  missing.push(...checkRequiredFields(stage, payload, customInput, existingCustomValues));

  // Campos customizados marcados como required para oportunidade
  const requiredCustom = await CustomFieldModel.listRequired('opportunity');
  requiredCustom.forEach((field) => {
    const val = resolveCustomValue(field.id, customInput, existingCustomValues)
      ?? resolveCustomValue(field.name, customInput, existingCustomValues);
    if (val === undefined || val === null || val === '') {
      missing.push(`custom:${field.name}`);
    }
  });

  return missing;
}

async function validateCustomRequired(entity, customInput = {}, existingCustomValues = []) {
  const missing = [];
  const requiredCustom = await CustomFieldModel.listRequired(entity);
  requiredCustom.forEach((field) => {
    const val = resolveCustomValue(field.id, customInput, existingCustomValues)
      ?? resolveCustomValue(field.name, customInput, existingCustomValues);
    if (val === undefined || val === null || val === '') {
      missing.push(`custom:${field.name}`);
    }
  });
  return missing;
}

async function persistCustomFields(entity, entityId, customInput = {}) {
  const entries = Object.entries(customInput || {});
  if (!entries.length) return;
  const fields = await CustomFieldModel.list(entity);
  for (const [key, value] of entries) {
    const field = fields.find((f) => f.id === key || String(f.name).toLowerCase() === String(key).toLowerCase());
    if (!field) continue;
    await CustomFieldValueModel.upsert({ field_id: field.id, entity_type: entity, entity_id: entityId, value });
  }
}

async function listPipelines(req, res) {
  try {
    const pipelines = await PipelineModel.listPipelines('opportunity');
    const withStages = await Promise.all(
      pipelines.map(async (p) => ({
        ...p,
        stages: await PipelineModel.getStages(p.id),
      })),
    );
    return res.json({ success: true, data: withStages });
  } catch (err) {
    console.error('[crm] listPipelines', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar pipelines' });
  }
}

async function listLeads(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const filter = {
      pipeline_id: req.query.pipeline_id || null,
      owner_id: req.query.owner_id || null,
      status: req.query.status || null,
      search: req.query.search || null,
    };
    const scopeParam = req.scopeResolved || req.query.scope || resolveViewScope(req);
    const { filter: scopedFilter, scope } = applyOwnerScope(filter, req.session?.user || {}, scopeParam);
    const rows = await LeadModel.listLeads(scopedFilter, { limit, offset });
    return res.json({ success: true, data: rows, scope });
  } catch (err) {
    console.error('[crm] listLeads', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar leads' });
  }
}

async function listOpportunities(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const filter = {
      pipeline_id: req.query.pipeline_id || null,
      stage_id: req.query.stage_id || null,
      owner_id: req.query.owner_id || null,
      contact_id: req.query.contact_id || null,
      search: req.query.search || null,
    };
    const scopeParam = req.scopeResolved || req.query.scope || resolveViewScope(req);
    const { filter: scopedFilter, scope } = applyOwnerScope(filter, req.session?.user || {}, scopeParam);
    const rows = await OpportunityModel.listOpportunities(scopedFilter, { limit, offset });
    return res.json({ success: true, data: rows, scope });
  } catch (err) {
    console.error('[crm] listOpportunities', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar oportunidades' });
  }
}

async function createLead(req, res) {
  try {
    const contact = normalizeContactInput(req.body || {});
    const customInput = req.body.custom_fields || {};
    if (!contact.phone && !contact.email) {
      return res.status(400).json({ success: false, error: 'Informe telefone ou e-mail do lead' });
    }

    const payload = {
      contact,
      pipeline_id: req.body.pipeline_id || null,
      owner_id: req.session.user.id,
      source: req.body.source || 'desconhecida',
      status: req.body.status || 'open',
      score: Number(req.body.score || 0),
      notes: req.body.notes || null,
    };

    const missingCustom = await validateCustomRequired('lead', customInput);
    if (missingCustom.length) {
      return res.status(400).json({ success: false, error: `Campos obrigatórios: ${missingCustom.join(', ')}` });
    }

    const lead = await LeadModel.createLead(payload);
    await persistCustomFields('lead', lead.id, customInput);
    return res.json({ success: true, data: lead });
  } catch (err) {
    console.error('[crm] createLead', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar lead' });
  }
}

async function createOpportunity(req, res) {
  try {
    const contactInput = normalizeContactInput(req.body || {});
    const pipeline_id = req.body.pipeline_id;
    const stage_id = req.body.stage_id;
    const title = (req.body.title || '').trim();
    const customInput = req.body.custom_fields || {};
    if (!title) return res.status(400).json({ success: false, error: 'Título é obrigatório' });
    if (!pipeline_id || !stage_id) {
      return res.status(400).json({ success: false, error: 'Pipeline e estágio são obrigatórios' });
    }

    const payload = {
      title,
      contact: contactInput.phone || contactInput.email ? contactInput : null,
      contact_id: req.body.contact_id || null,
      account_id: req.body.account_id || null,
      pipeline_id,
      stage_id,
      amount: req.body.amount,
      close_date: req.body.close_date || null,
      owner_id: req.session.user.id,
      source: req.body.source || 'desconhecida',
      description: req.body.description || null,
      probability_override: req.body.probability_override || null,
    };

    const stage = await PipelineModel.getStageById(stage_id);
    if (!stage) return res.status(400).json({ success: false, error: 'Estágio inválido' });

    const missing = await validateOpportunityRequired({
      stage,
      payload: combineData({}, payload),
      customInput,
      existingCustomValues: [],
    });
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Campos obrigatórios no estágio: ${missing.join(', ')}` });
    }

    const opp = await OpportunityModel.createOpportunity(payload);
    await persistCustomFields('opportunity', opp.id, customInput);
    await scheduleStageSla(stage, opp);
    await applyAutoActions(stage, opp);
    return res.json({ success: true, data: opp });
  } catch (err) {
    console.error('[crm] createOpportunity', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar oportunidade' });
  }
}

async function moveOpportunityStage(req, res) {
  try {
    const id = req.params.id;
    const targetStageId = req.body.stage_id;
    const customInput = req.body.custom_fields || {};
    if (!targetStageId) return res.status(400).json({ success: false, error: 'Informe o estágio de destino' });

    const opp = await OpportunityModel.findById(id);
    if (!opp) return res.status(404).json({ success: false, error: 'Oportunidade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && opp.owner_id && opp.owner_id !== userId) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const currentStage = await PipelineModel.getStageById(opp.stage_id);
    const targetStage = await PipelineModel.getStageById(targetStageId);
    if (!targetStage) return res.status(400).json({ success: false, error: 'Estágio destino inválido' });
    if (currentStage.pipeline_id !== targetStage.pipeline_id) {
      return res.status(400).json({ success: false, error: 'Não é permitido mover para pipeline diferente' });
    }

    const delta = targetStage.position - currentStage.position;
    if (targetStage.forbid_back && delta < 0) {
      return res.status(400).json({ success: false, error: 'Regra do pipeline: não pode voltar estágio' });
    }
    if (currentStage.forbid_jump && Math.abs(delta) > 1) {
      return res.status(400).json({ success: false, error: 'Regra do pipeline: não pode pular estágio' });
    }

    const existingCustomValues = isUuid(opp.id) ? await CustomFieldValueModel.listValues('opportunity', opp.id) : [];
    const missing = await validateOpportunityRequired({
      stage: targetStage,
      payload: combineData(opp, req.body || {}),
      customInput,
      existingCustomValues,
    });
    if (missing.length) {
      return res.status(400).json({ success: false, error: `Campos obrigatórios no estágio: ${missing.join(', ')}` });
    }

    const updated = await OpportunityModel.updateStage(id, targetStageId);
    if (isUuid(id)) { await persistCustomFields('opportunity', id, customInput); }
    await scheduleStageSla(targetStage, updated);
    await applyAutoActions(targetStage, updated);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] moveOpportunityStage', err);
    return res.status(500).json({ success: false, error: 'Erro ao mover estágio' });
  }
}

async function createActivity(req, res) {
  try {
    const customInput = req.body.custom_fields || {};
    const payload = {
      type: req.body.type || 'task',
      subject: req.body.subject,
      starts_at: req.body.starts_at || null,
      ends_at: req.body.ends_at || null,
      owner_id: req.session?.user?.id || null,
      related_type: req.body.related_type || null,
      related_id: req.body.related_id || null,
      status: req.body.status || 'pending',
      location: req.body.location || null,
    };
    const missingCustom = await validateCustomRequired('activity', customInput);
    if (missingCustom.length) {
      return res.status(400).json({ success: false, error: `Campos obrigatórios: ${missingCustom.join(', ')}` });
    }
    const activity = await ActivityModel.createActivity(payload);
    await persistCustomFields('activity', activity.id, customInput);
    return res.json({ success: true, data: activity });
  } catch (err) {
    console.error('[crm] createActivity', err);
    return res.status(500).json({ success: false, error: 'Erro ao criar atividade' });
  }
}

async function listActivities(req, res) {
  try {
    const filter = {
      related_type: req.query.related_type || null,
      related_id: req.query.related_id || null,
      owner_id: null,
    };
    const scopeParam = req.scopeResolved || req.query.scope || resolveViewScope(req);
    const { filter: scopedFilter, scope } = applyOwnerScope(
      {
        ...filter,
        owner_id: req.query.owner_id || null,
      },
      req.session?.user || {},
      scopeParam,
    );

    const rows = await ActivityModel.listActivities(scopedFilter);
    return res.json({ success: true, data: rows, scope });
  } catch (err) {
    console.error('[crm] listActivities', err);
    return res.status(500).json({ success: false, error: 'Erro ao listar atividades' });
  }
}

async function updateActivityStatus(req, res) {
  try {
    const id = req.params.id;
    const status = req.body.status;
    if (!status) return res.status(400).json({ success: false, error: 'Status é obrigatório' });
    const updated = await ActivityModel.updateStatus(id, status);
    if (!updated) return res.status(404).json({ success: false, error: 'Atividade não encontrada' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] updateActivityStatus', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar atividade' });
  }
}

async function statsPipeline(req, res) {
  try {
    const data = await CrmStats.pipelineByStageMonth({ user: req.session?.user });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] statsPipeline', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas' });
  }
}


async function updateStageConfig(req, res) {
  try {
    const id = req.params.id;
    const payload = {
      name: req.body.name,
      position: req.body.position,
      probability: req.body.probability,
      color: req.body.color,
      sla_minutes: req.body.sla_minutes,
    };
    const updated = await PipelineModel.updateStage(id, payload);
    if (!updated) return res.status(404).json({ success: false, error: 'Estágio não encontrado' });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] updateStageConfig', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar estágio' });
  }
}

async function updateStageRule(req, res) {
  try {
    const id = req.params.id;
    const rule = {
      required_fields: Array.isArray(req.body.required_fields) ? req.body.required_fields : [],
      forbid_jump: req.body.forbid_jump === true || String(req.body.forbid_jump).toLowerCase() === 'true',
      forbid_back: req.body.forbid_back === true || String(req.body.forbid_back).toLowerCase() === 'true',
      auto_actions: req.body.auto_actions || [],
    };
    const updated = await PipelineModel.upsertRule(id, rule);
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[crm] updateStageRule', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar regra' });
  }
}

async function statsActivities(req, res) {
  try {
    const data = await CrmStats.activitiesByOwner({ user: req.session?.user });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] statsActivities', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas' });
  }
}

function formatIcsDate(dateStr, fallbackMinutes = 60) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}


async function refreshStats(_req, res) {
  try {
    await CrmStats.refreshMaterializedViews();
    return res.json({ success: true, data: { refreshed: true } });
  } catch (err) {
    console.error('[crm] refreshStats', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar estatísticas' });
  }
}

async function exportActivitiesICS(req, res) {
  try {
    const filter = {};
    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    const scope = resolveViewScope(req);
    if (!isPrivileged(role) && userId) filter.owner_id = userId;
    const rows = await ActivityModel.listActivities(filter);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LATE//CRM//PT-BR'];
    rows.forEach((a) => {
      const uid = `${a.id || Math.random()}@late`;
      const dtStart = formatIcsDate(a.starts_at) || formatIcsDate(a.created_at);
      const dtEnd = formatIcsDate(a.ends_at) || dtStart;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      if (dtStart) lines.push(`DTSTART:${dtStart}`);
      if (dtEnd) lines.push(`DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${a.subject || 'Atividade'}`);
      if (a.status) lines.push(`STATUS:${a.status}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    return res.send(lines.join('\r\n'));
  } catch (err) {
    console.error('[crm] exportActivitiesICS', err);
    return res.status(500).json({ success: false, error: 'Erro ao exportar ICS' });
  }
}


function splitCsvLine(line = '') {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 1; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function parseCsvRows(csv = '') {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { header: [], rows: [] };
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  return { header, rows };
}

function mapLeadRow(header, row) {
  const idx = (name) => header.indexOf(name);
  const get = (name) => {
    const i = idx(name);
    return i >= 0 ? (row[i] || '').trim() : '';
  };
  return {
    name: get('name'),
    phone: get('phone') || get('telefone') || get('celular'),
    email: get('email'),
    source: get('source') || get('fonte') || null,
    notes: get('notes') || get('observacao') || null,
  };
}

function toCsvRow(values = []) {
  return values
    .map((v) => {
      const s = v === null || v === undefined ? '' : String(v);
      if (s.includes(',') || s.includes('\"')) {
        return '"' + s.replace(/\"/g, '""') + '"';
      }
      return s;
    })
    .join(',');
}

function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (Array.isArray(value)) {
    return parseJsonField(value[0], fallback);
  }
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_err) {
    return fallback;
  }
}

function parseBooleanField(value) {
  if (Array.isArray(value)) {
    return parseBooleanField(value[0]);
  }
  const text = String(value || '').toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function normalizeFormValue(value) {
  if (Array.isArray(value)) {
    return normalizeFormValue(value[0]);
  }
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text || text === 'null' || text === 'undefined') return null;
  return text;
}

async function parseImportRequest(req) {
  if (req.is('multipart/form-data')) {
    const form = formidable({
      maxFileSize: 100 * 1024 * 1024,
      allowEmptyFiles: false,
      multiples: false,
    });
    return new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        const fileCandidate = files?.csv || files?.file || files?.upload || null;
        const file = Array.isArray(fileCandidate) ? fileCandidate[0] : fileCandidate;
        const filePath = file?.filepath || null;
        resolve({
          csv: fields?.csv || null,
          filePath,
          fields: fields || {},
        });
      });
    });
  }
  return {
    csv: req.body?.csv || null,
    filePath: null,
    fields: req.body || {},
  };
}

async function exportLeadsCsv(_req, res) {
  try {
    const rows = await LeadModel.listLeads({}, { limit: 1000, offset: 0 });
    const header = ['id', 'contact_name', 'phone', 'email', 'source', 'status', 'owner_id'];
    const lines = [toCsvRow(header)];
    rows.forEach((r) => {
      lines.push(toCsvRow([r.id, r.contact_name, r.phone, r.email, r.source, r.status, r.owner_id]));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(lines.join('\n'));
  } catch (err) {
    console.error('[crm] exportLeadsCsv', err);
    return res.status(500).json({ success: false, error: 'Erro ao exportar leads' });
  }
}

async function exportOpportunitiesCsv(_req, res) {
  try {
    const rows = await OpportunityModel.listOpportunities({}, { limit: 1000, offset: 0 });
    const header = ['id', 'title', 'contact_name', 'amount', 'close_date', 'pipeline_id', 'stage_id', 'owner_id'];
    const lines = [toCsvRow(header)];
    rows.forEach((r) => {
      lines.push(toCsvRow([r.id, r.title, r.contact_name, r.amount, r.close_date, r.pipeline_id, r.stage_id, r.owner_id]));
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(lines.join('\n'));
  } catch (err) {
    console.error('[crm] exportOpportunitiesCsv', err);
    return res.status(500).json({ success: false, error: 'Erro ao exportar oportunidades' });
  }
}


async function previewLeadsCsv(req, res) {
  let payload;
  try {
    payload = await parseImportRequest(req);
    const mapping = parseJsonField(payload.fields?.mapping, {});
    const targetType = String(normalizeFormValue(payload.fields?.target_type) || 'lead').toLowerCase();
    if (!['lead', 'opportunity'].includes(targetType)) {
      return res.status(400).json({ success: false, error: 'target_type inválido' });
    }
    const limit = Number(normalizeFormValue(payload.fields?.limit)) || 50;
    if (!payload.csv && !payload.filePath) {
      return res.status(400).json({ success: false, error: 'CSV obrigatório' });
    }
    const data = await CrmImportService.previewCsv({
      csv: payload.csv,
      filePath: payload.filePath,
      mapping,
      targetType,
      limit,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] previewLeadsCsv', err);
    return res.status(500).json({ success: false, error: 'Erro ao pré-visualizar CSV' });
  } finally {
    if (payload?.filePath) {
      fs.unlink(payload.filePath, () => {});
    }
  }
}

async function importLeadsCsv(req, res) {
  let payload;
  try {
    payload = await parseImportRequest(req);
    const mapping = parseJsonField(payload.fields?.mapping, {});
    const targetType = String(normalizeFormValue(payload.fields?.target_type) || 'lead').toLowerCase();
    if (!['lead', 'opportunity'].includes(targetType)) {
      return res.status(400).json({ success: false, error: 'target_type inválido' });
    }
    if (!payload.csv && !payload.filePath) {
      return res.status(400).json({ success: false, error: 'CSV obrigatório' });
    }
    const skipDuplicates = parseBooleanField(payload.fields?.skip_duplicates);
    const data = await CrmImportService.applyImport({
      csv: payload.csv,
      filePath: payload.filePath,
      mapping,
      targetType,
      options: {
        skipDuplicates,
        duplicate_mode: normalizeFormValue(payload.fields?.duplicate_mode),
        pipeline_id: normalizeFormValue(payload.fields?.pipeline_id),
        stage_id: normalizeFormValue(payload.fields?.stage_id),
        pipeline_name: normalizeFormValue(payload.fields?.pipeline_name),
        stage_name: normalizeFormValue(payload.fields?.stage_name),
        source: normalizeFormValue(payload.fields?.source) || 'import_csv',
      },
      user: req.session?.user,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] importLeadsCsv', err);
    return res.status(500).json({ success: false, error: 'Erro ao importar CSV' });
  } finally {
    if (payload?.filePath) {
      fs.unlink(payload.filePath, () => {});
    }
  }
}

async function dryRunImportCsv(req, res) {
  let payload;
  try {
    payload = await parseImportRequest(req);
    const mapping = parseJsonField(payload.fields?.mapping, {});
    const targetType = String(normalizeFormValue(payload.fields?.target_type) || 'lead').toLowerCase();
    if (!['lead', 'opportunity'].includes(targetType)) {
      return res.status(400).json({ success: false, error: 'target_type inválido' });
    }
    if (!payload.csv && !payload.filePath) {
      return res.status(400).json({ success: false, error: 'CSV obrigatório' });
    }
    const data = await CrmImportService.dryRunImport({
      csv: payload.csv,
      filePath: payload.filePath,
      mapping,
      targetType,
      options: {
        pipeline_id: normalizeFormValue(payload.fields?.pipeline_id),
        stage_id: normalizeFormValue(payload.fields?.stage_id),
        pipeline_name: normalizeFormValue(payload.fields?.pipeline_name),
        stage_name: normalizeFormValue(payload.fields?.stage_name),
        source: normalizeFormValue(payload.fields?.source) || 'import_csv',
        duplicate_mode: normalizeFormValue(payload.fields?.duplicate_mode),
        sample_limit: normalizeFormValue(payload.fields?.sample_limit),
      },
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[crm] dryRunImportCsv', err);
    return res.status(500).json({ success: false, error: 'Erro ao simular importação' });
  } finally {
    if (payload?.filePath) {
      fs.unlink(payload.filePath, () => {});
    }
  }
}

module.exports = {
  listPipelines,
  listLeads,
  listOpportunities,
  createLead,
  createOpportunity,
  moveOpportunityStage,
  createActivity,
  listActivities,
  updateActivityStatus,
  statsPipeline,
  statsActivities,
  exportActivitiesICS,
  exportLeadsCsv,
  exportOpportunitiesCsv,
  previewLeadsCsv,
  importLeadsCsv,
  dryRunImportCsv,
  refreshStats,
  updateStageConfig,
  updateStageRule,
};
