// services/crmImportService.js
// Serviço de importação CSV (preview/dry-run/apply) com parsing streaming.

const fs = require('fs');
const { parse } = require('csv-parse');
const { Readable } = require('stream');
const ContactModel = require('../models/contact');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const { normalizeEmail, normalizePhone } = require('../utils/normalizeContact');

const DEFAULT_PREVIEW_LIMIT = 50;
const DEFAULT_SAMPLE_LIMIT = 200;

const TARGET_FIELDS = {
  lead: [
    'name',
    'phone',
    'email',
    'source',
    'notes',
    'status',
    'score',
  ],
  opportunity: [
    'title',
    'amount',
    'close_date',
    'description',
    'pipeline_id',
    'stage_id',
    'name',
    'phone',
    'email',
    'source',
    'probability_override',
  ],
};

const FIELD_ALIASES = {
  name: ['name', 'nome', 'contato', 'contact', 'contact_name'],
  phone: ['phone', 'telefone', 'celular', 'whatsapp', 'tel', 'mobile'],
  email: ['email', 'e-mail', 'mail'],
  source: ['source', 'fonte', 'origem'],
  notes: ['notes', 'observacao', 'observações', 'obs', 'nota'],
  title: ['title', 'titulo', 'oportunidade', 'opportunity'],
  amount: ['amount', 'valor', 'value', 'valor_total'],
  close_date: ['close_date', 'data_fechamento', 'fechamento'],
  description: ['description', 'descricao', 'detalhes'],
  status: ['status', 'situacao'],
  score: ['score', 'pontuacao'],
  pipeline_id: ['pipeline_id', 'pipeline'],
  stage_id: ['stage_id', 'stage', 'etapa_id', 'etapa'],
  probability_override: ['probability_override', 'probabilidade'],
};

const ALIAS_TO_TARGET = Object.entries(FIELD_ALIASES).reduce((acc, [target, aliases]) => {
  aliases.forEach((alias) => {
    acc[normalizeHeader(alias)] = target;
  });
  return acc;
}, {});

function assertTargetType(targetType) {
  if (!TARGET_FIELDS[targetType]) {
    throw new Error('targetType inválido');
  }
}

function normalizeHeader(header = '') {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function normalizeMapping(mapping = {}, targetType = 'lead') {
  const normalized = {};
  const allowed = TARGET_FIELDS[targetType] || [];
  Object.entries(mapping || {}).forEach(([csvKey, target]) => {
    const key = normalizeHeader(csvKey);
    const resolvedTarget = String(target || '').trim();
    if (!key || !resolvedTarget) return;
    if (allowed.length && !allowed.includes(resolvedTarget)) return;
    normalized[key] = resolvedTarget;
  });
  return normalized;
}

function buildAutoMapping(headers = [], targetType = 'lead') {
  const allowed = TARGET_FIELDS[targetType] || [];
  const mapping = {};
  headers.forEach((rawHeader) => {
    const key = normalizeHeader(rawHeader);
    const target = ALIAS_TO_TARGET[key] || (allowed.includes(key) ? key : null);
    if (!target) return;
    if (!mapping[key]) mapping[key] = target;
  });
  return mapping;
}

function resolveMappedRow(row = {}, mapping = {}) {
  const resolved = {};
  Object.entries(mapping || {}).forEach(([csvKey, target]) => {
    resolved[target] = row[csvKey] ?? '';
  });
  return resolved;
}

function normalizeRow(row = {}) {
  const normalized = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeHeader(key);
    normalized[normalizedKey] = value === undefined || value === null ? '' : String(value).trim();
  });
  return normalized;
}

function getDuplicateMode(options = {}) {
  if (options.skipDuplicates || options.skip_duplicates) return 'skip';
  const mode = String(options.duplicate_mode || '').toLowerCase();
  if (mode === 'skip') return 'skip';
  return 'merge';
}

function createParser() {
  return parse({
    columns: (header) => header.map(normalizeHeader),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  });
}

function createSourceStream({ csv, filePath }) {
  if (filePath) return fs.createReadStream(filePath);
  return Readable.from([csv || '']);
}

async function iterateCsv({ csv, filePath, limit, onRow }) {
  const parser = createParser();
  const source = createSourceStream({ csv, filePath });
  source.pipe(parser);

  let count = 0;
  try {
    for await (const record of parser) {
      count += 1;
      const normalized = normalizeRow(record);
      await onRow(normalized, count);
      if (limit && count >= limit) {
        if (typeof source.destroy === 'function') source.destroy();
        if (typeof parser.destroy === 'function') parser.destroy();
        break;
      }
    }
  } finally {
    if (typeof source.destroy === 'function') source.destroy();
  }
  return count;
}

async function findDuplicates({ phone, email } = {}) {
  const phoneNorm = normalizePhone(phone);
  const emailNorm = normalizeEmail(email);
  if (!phoneNorm && !emailNorm) return null;
  return ContactModel.findByAnyIdentifier({ phone: phoneNorm, email: emailNorm });
}

function buildLeadPayload(mapped = {}, options = {}, user) {
  return {
    contact: {
      name: mapped.name || null,
      phone: mapped.phone || null,
      email: mapped.email || null,
    },
    pipeline_id: options.pipeline_id || null,
    owner_id: user?.id || null,
    source: mapped.source || options.source || 'import_csv',
    status: mapped.status || options.status || 'open',
    score: mapped.score ? Number(mapped.score) : 0,
    notes: mapped.notes || null,
  };
}

function buildOpportunityPayload(mapped = {}, options = {}, user) {
  const title = mapped.title || mapped.name || 'Oportunidade';
  return {
    title,
    contact: {
      name: mapped.name || null,
      phone: mapped.phone || null,
      email: mapped.email || null,
    },
    pipeline_id: mapped.pipeline_id || options.pipeline_id || null,
    stage_id: mapped.stage_id || options.stage_id || null,
    amount: mapped.amount ? Number(mapped.amount) : 0,
    close_date: mapped.close_date || null,
    owner_id: user?.id || null,
    source: mapped.source || options.source || 'import_csv',
    description: mapped.description || null,
    probability_override: mapped.probability_override ? Number(mapped.probability_override) : null,
  };
}

function validateRequired(mapped = {}, targetType = 'lead', options = {}) {
  if (targetType === 'lead') {
    if (!mapped.phone && !mapped.email) {
      return 'Informe telefone ou e-mail do lead.';
    }
    return null;
  }
  if (!mapped.title && !mapped.name) {
    return 'Título da oportunidade é obrigatório.';
  }
  if (!mapped.pipeline_id && !options.pipeline_id) {
    return 'pipeline_id é obrigatório para oportunidades.';
  }
  if (!mapped.stage_id && !options.stage_id) {
    return 'stage_id é obrigatório para oportunidades.';
  }
  if (!mapped.phone && !mapped.email) {
    return 'Informe telefone ou e-mail do contato.';
  }
  return null;
}

async function previewCsv({ csv, filePath, mapping = {}, targetType = 'lead', limit = DEFAULT_PREVIEW_LIMIT } = {}) {
  assertTargetType(targetType);
  const normalizedMapping = normalizeMapping(mapping, targetType);
  const preview = [];
  let duplicates = 0;
  let headers = [];
  let finalMapping = normalizedMapping;

  await iterateCsv({
    csv,
    filePath,
    limit,
    onRow: async (row, idx) => {
      if (idx === 1) {
        headers = Object.keys(row);
        if (!Object.keys(finalMapping).length) {
          finalMapping = buildAutoMapping(headers, targetType);
        }
      }
      const resolved = resolveMappedRow(row, finalMapping);
      const dup = await findDuplicates({ phone: resolved.phone, email: resolved.email });
      if (dup) duplicates += 1;
      preview.push({
        raw: row,
        mapped: resolved,
        duplicate: Boolean(dup),
        duplicate_id: dup?.id || null,
      });
    },
  });

  return {
    total: preview.length,
    duplicates,
    headers,
    mapping: finalMapping,
    rows: preview,
  };
}

async function dryRunImport({ csv, filePath, mapping = {}, targetType = 'lead', options = {} } = {}) {
  assertTargetType(targetType);
  const normalizedMapping = normalizeMapping(mapping, targetType);
  const summary = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    conflicts: 0,
    errors: 0,
    items: [],
  };
  const duplicateMode = getDuplicateMode(options);
  const sampleLimit = Number(options.sample_limit || DEFAULT_SAMPLE_LIMIT);
  let headers = [];
  let finalMapping = normalizedMapping;

  await iterateCsv({
    csv,
    filePath,
    onRow: async (row, idx) => {
      if (idx === 1) {
        headers = Object.keys(row);
        if (!Object.keys(finalMapping).length) {
          finalMapping = buildAutoMapping(headers, targetType);
        }
      }
      summary.total += 1;
      const resolved = resolveMappedRow(row, finalMapping);
      const error = validateRequired(resolved, targetType, options);
      if (error) {
        summary.errors += 1;
        if (summary.items.length < sampleLimit) {
          summary.items.push({ action: 'error', error, data: resolved });
        }
        return;
      }
      const dup = await findDuplicates({ phone: resolved.phone, email: resolved.email });
      if (dup && duplicateMode === 'skip') {
        summary.skipped += 1;
        if (summary.items.length < sampleLimit) {
          summary.items.push({ action: 'skip', contact_id: dup.id, data: resolved });
        }
        return;
      }
      if (dup) {
        summary.updated += 1;
        if (summary.items.length < sampleLimit) {
          summary.items.push({ action: 'merge', contact_id: dup.id, data: resolved });
        }
      } else {
        summary.created += 1;
        if (summary.items.length < sampleLimit) {
          summary.items.push({ action: 'create', contact_id: null, data: resolved });
        }
      }
    },
  });

  summary.targetType = targetType;
  summary.options = { ...options, duplicate_mode: duplicateMode };
  summary.mapping = finalMapping;
  summary.headers = headers;
  return summary;
}

async function applyImport({ csv, filePath, mapping = {}, targetType = 'lead', options = {}, user } = {}) {
  assertTargetType(targetType);
  const normalizedMapping = normalizeMapping(mapping, targetType);
  const summary = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };
  const duplicateMode = getDuplicateMode(options);
  let headers = [];
  let finalMapping = normalizedMapping;

  await iterateCsv({
    csv,
    filePath,
    onRow: async (row, idx) => {
      if (idx === 1) {
        headers = Object.keys(row);
        if (!Object.keys(finalMapping).length) {
          finalMapping = buildAutoMapping(headers, targetType);
        }
      }
      summary.total += 1;
      const resolved = resolveMappedRow(row, finalMapping);
      const error = validateRequired(resolved, targetType, options);
      if (error) {
        summary.errors += 1;
        return;
      }

      const dup = await findDuplicates({ phone: resolved.phone, email: resolved.email });
      if (dup && duplicateMode === 'skip') {
        summary.skipped += 1;
        return;
      }

      if (dup && duplicateMode === 'merge') {
        await ContactModel.updateById(dup.id, {
          name: resolved.name,
          phone: resolved.phone,
          email: resolved.email,
        });
      }

      if (targetType === 'lead') {
        const payload = buildLeadPayload(resolved, options, user);
        if (dup) {
          await LeadModel.createLead({
            contact_id: dup.id,
            pipeline_id: payload.pipeline_id,
            owner_id: payload.owner_id,
            source: payload.source,
            status: payload.status,
            score: payload.score,
            notes: payload.notes,
          });
          summary.updated += 1;
        } else {
          await LeadModel.createLead(payload);
          summary.created += 1;
        }
        return;
      }

      if (targetType === 'opportunity') {
        const payload = buildOpportunityPayload(resolved, options, user);
        if (dup) {
          await OpportunityModel.createOpportunity({
            ...payload,
            contact_id: dup.id,
          });
          summary.updated += 1;
        } else {
          await OpportunityModel.createOpportunity(payload);
          summary.created += 1;
        }
      }
    },
  });

  summary.targetType = targetType;
  summary.options = { ...options, duplicate_mode: duplicateMode };
  summary.mapping = finalMapping;
  summary.headers = headers;
  return summary;
}

module.exports = {
  previewCsv,
  dryRunImport,
  applyImport,
  normalizeMapping,
  buildAutoMapping,
};
