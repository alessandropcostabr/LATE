// controllers/crm/helpers.js
// Helpers compartilhados do CRM (contato, custom fields, import, SLA, etc.).

const fs = require('fs');
const { formidable } = require('formidable');
const CustomFieldModel = require('../../models/customField');
const CustomFieldValueModel = require('../../models/customFieldValue');
const ActivityModel = require('../../models/activity');
const OpportunityModel = require('../../models/opportunity');
const { validateCsvFile } = require('../../middleware/fileValidation');
const { normalizePhone } = require('../../utils/phone');
const { normalizeEmail } = require('../../utils/normalizeContact');

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

async function validateOpportunityRequired({ stage, payload, customInput, existingCustomValues }) {
  const missing = [];
  missing.push(...checkRequiredFields(stage, payload, customInput, existingCustomValues));

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

function formatIcsDate(dateStr, fallbackMinutes = 60) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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
      if (s.includes(',') || s.includes('"')) {
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
        if (err) {
          err.statusCode = err.statusCode || 400;
          return reject(err);
        }
        const fileCandidate = files?.csv || files?.file || files?.upload || null;
        const file = Array.isArray(fileCandidate) ? fileCandidate[0] : fileCandidate;
        const filePath = file?.filepath || null;

        if (filePath && file) {
          const validation = validateCsvFile(filePath, file.originalFilename || file.name, file.mimetype);
          if (!validation.valid) {
            if (filePath) {
              fs.unlink(filePath, () => {});
            }
            const error = new Error(validation.error);
            error.statusCode = 400;
            return reject(error);
          }
        }

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

module.exports = {
  applyAutoActions,
  checkRequiredFields,
  combineData,
  formatIcsDate,
  isPrivileged,
  isUuid,
  mapLeadRow,
  normalizeContactInput,
  normalizeFormValue,
  parseBooleanField,
  parseCsvRows,
  parseImportRequest,
  parseJsonField,
  persistCustomFields,
  resolveCustomValue,
  resolveViewScope,
  scheduleStageSla,
  splitCsvLine,
  toCsvRow,
  validateCustomRequired,
  validateOpportunityRequired,
};
