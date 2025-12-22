// services/crmImportService.js
// Serviço de importação CSV (preview/dry-run/apply) com parsing streaming.

const fs = require('fs');
const { parse } = require('csv-parse');
const { Readable } = require('stream');
const db = require('../config/database');
const ContactModel = require('../models/contact');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const PipelineModel = require('../models/pipeline');
const { normalizeEmail, normalizePhone } = require('../utils/normalizeContact');

const DEFAULT_PREVIEW_LIMIT = 50;
const DEFAULT_SAMPLE_LIMIT = 200;
const MAX_IMPORT_TIME_MS = 5 * 60 * 1000; // 5 minutes max for import
const MAX_ROWS_PER_IMPORT = Number(process.env.CRM_IMPORT_MAX_ROWS) > 0
  ? Number(process.env.CRM_IMPORT_MAX_ROWS)
  : 10000; // Maximum rows allowed per import
const BACKPRESSURE_THRESHOLD = 100; // Pause stream after this many pending rows

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
    'pipeline_name',
    'stage_id',
    'stage_name',
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
  pipeline_name: ['pipeline_name', 'funil', 'pipeline_nome'],
  stage_id: ['stage_id', 'stage', 'etapa_id', 'etapa'],
  stage_name: ['stage_name', 'etapa_nome', 'stage_nome'],
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

function normalizeNameKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

async function buildPipelineLookup() {
  const pipelines = await PipelineModel.listPipelines('opportunity');
  const pipelineByName = {};
  const stageByPipeline = {};
  const stageNameHits = {};

  for (const pipeline of pipelines) {
    const key = normalizeNameKey(pipeline.name);
    if (key) pipelineByName[key] = pipeline.id;
    const stages = await PipelineModel.getStages(pipeline.id);
    const stageMap = {};
    stages.forEach((stage) => {
      const stageKey = normalizeNameKey(stage.name);
      if (!stageKey) return;
      stageMap[stageKey] = stage.id;
      stageNameHits[stageKey] = (stageNameHits[stageKey] || 0) + 1;
    });
    stageByPipeline[pipeline.id] = stageMap;
  }

  const stageByNameUnique = {};
  Object.keys(stageNameHits).forEach((key) => {
    if (stageNameHits[key] === 1) {
      const pipelineId = Object.keys(stageByPipeline).find((pid) => stageByPipeline[pid][key]);
      if (pipelineId) stageByNameUnique[key] = stageByPipeline[pipelineId][key];
    }
  });

  return { pipelineByName, stageByPipeline, stageByNameUnique };
}

function resolvePipelineStage(mapped = {}, options = {}, lookup) {
  const resolved = {
    pipeline_id: mapped.pipeline_id || options.pipeline_id || null,
    stage_id: mapped.stage_id || options.stage_id || null,
  };

  if (!resolved.pipeline_id) {
    const pipelineName = mapped.pipeline_name || options.pipeline_name;
    const key = normalizeNameKey(pipelineName);
    if (key && lookup.pipelineByName[key]) {
      resolved.pipeline_id = lookup.pipelineByName[key];
    }
  }

  if (!resolved.stage_id) {
    const stageName = mapped.stage_name || options.stage_name;
    const stageKey = normalizeNameKey(stageName);
    if (stageKey) {
      if (resolved.pipeline_id && lookup.stageByPipeline[resolved.pipeline_id]) {
        resolved.stage_id = lookup.stageByPipeline[resolved.pipeline_id][stageKey] || null;
      } else if (lookup.stageByNameUnique[stageKey]) {
        resolved.stage_id = lookup.stageByNameUnique[stageKey];
      }
    }
  }

  return resolved;
}

async function iterateCsv({ csv, filePath, limit, onRow, timeout = MAX_IMPORT_TIME_MS }) {
  const parser = createParser();
  const source = createSourceStream({ csv, filePath });
  source.pipe(parser);

  let count = 0;
  let isPaused = false;
  let pendingRows = 0;
  const startTime = Date.now();
  let timeoutError = null;

  // Timeout handler
  const timeoutId = setTimeout(() => {
    timeoutError = new Error(`Import timeout: exceeded ${timeout / 1000} seconds`);
    if (typeof source.destroy === 'function') source.destroy();
    if (typeof parser.destroy === 'function') parser.destroy();
  }, timeout);

  try {
    for await (const record of parser) {
      // Check timeout
      if (timeoutError || Date.now() - startTime > timeout) {
        timeoutError = timeoutError || new Error(`Import timeout: exceeded ${timeout / 1000} seconds`);
        throw timeoutError;
      }

      count += 1;

      // Check row limit
      if (count > MAX_ROWS_PER_IMPORT) {
        throw new Error(`Import limit exceeded: maximum ${MAX_ROWS_PER_IMPORT} rows allowed`);
      }

      const normalized = normalizeRow(record);

      // Backpressure: pause stream if too many pending rows
      pendingRows += 1;
      if (pendingRows >= BACKPRESSURE_THRESHOLD && !isPaused) {
        isPaused = true;
        parser.pause();
      }

      // Process row
      try {
        await onRow(normalized, count);
      } finally {
        // Resume stream if backpressure reduced
        pendingRows -= 1;
        if (pendingRows < BACKPRESSURE_THRESHOLD / 2 && isPaused) {
          isPaused = false;
          parser.resume();
        }
      }

      if (limit && count >= limit) {
        if (typeof source.destroy === 'function') source.destroy();
        if (typeof parser.destroy === 'function') parser.destroy();
        break;
      }
    }
    if (timeoutError) {
      throw timeoutError;
    }
  } catch (err) {
    if (timeoutError && err !== timeoutError) {
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    if (typeof source.destroy === 'function') source.destroy();
  }
  return count;
}

async function findDuplicates({ phone, email } = {}, client = null) {
  const phoneNorm = normalizePhone(phone);
  const emailNorm = normalizeEmail(email);
  if (!phoneNorm && !emailNorm) return null;
  return ContactModel.findByAnyIdentifier({ phone: phoneNorm, email: emailNorm }, client);
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

function resolveOpportunityErrors(mapped = {}, options = {}) {
  const errors = [];
  if ((mapped.pipeline_name || options.pipeline_name) && !mapped.pipeline_id) {
    errors.push(`Pipeline não encontrado: ${mapped.pipeline_name || options.pipeline_name}`);
  }
  if ((mapped.stage_name || options.stage_name) && !mapped.stage_id) {
    errors.push(`Etapa não encontrada: ${mapped.stage_name || options.stage_name}`);
  }
  return errors;
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
  if (!mapped.pipeline_id && !mapped.pipeline_name && !options.pipeline_id && !options.pipeline_name) {
    return 'pipeline_id ou pipeline_name é obrigatório para oportunidades.';
  }
  if (!mapped.stage_id && !mapped.stage_name && !options.stage_id && !options.stage_name) {
    return 'stage_id ou stage_name é obrigatório para oportunidades.';
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
  let pipelineLookup = null;
  const ensureLookup = async () => {
    if (!pipelineLookup) pipelineLookup = await buildPipelineLookup();
    return pipelineLookup;
  };

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
      if (targetType === 'opportunity') {
        const lookup = await ensureLookup();
        const resolvedIds = resolvePipelineStage(resolved, options, lookup);
        if (resolvedIds.pipeline_id) resolved.pipeline_id = resolvedIds.pipeline_id;
        if (resolvedIds.stage_id) resolved.stage_id = resolvedIds.stage_id;
        const nameErrors = resolveOpportunityErrors(resolved, options);
        if (nameErrors.length) {
          summary.errors += 1;
          if (summary.items.length < sampleLimit) {
            summary.items.push({ action: 'error', error: nameErrors.join(' | '), data: resolved });
          }
          return;
        }
      }
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

async function applyImport({
  csv,
  filePath,
  mapping = {},
  targetType = 'lead',
  options = {},
  user,
  dbClient,
} = {}) {
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
  const chunkSize = Math.min(Number(options.chunk_size || 100), 500); // Limit batch size for memory control
  let headers = [];
  let finalMapping = normalizedMapping;
  let pipelineLookup = null;
  const ensureLookup = async () => {
    if (!pipelineLookup) pipelineLookup = await buildPipelineLookup();
    return pipelineLookup;
  };

  const client = dbClient || await db.connect();
  const shouldRelease = !dbClient;
  const startTime = Date.now();
  let lastProgressLog = Date.now();

  // Log progress periodically
  const logProgress = () => {
    const now = Date.now();
    if (now - lastProgressLog > 5000) { // Log every 5 seconds
      console.log(`[CRM Import] Progress: ${summary.total} processed, ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.errors} errors`);
      lastProgressLog = now;
    }
  };

  try {
    await client.query('BEGIN');
    const batch = [];

    const processBatch = async () => {
      if (!batch.length) return;
      for (const item of batch) {
        summary.total += 1;
        const resolved = item.resolved;
        if (targetType === 'opportunity') {
          const lookup = await ensureLookup();
          const resolvedIds = resolvePipelineStage(resolved, options, lookup);
          if (resolvedIds.pipeline_id) resolved.pipeline_id = resolvedIds.pipeline_id;
          if (resolvedIds.stage_id) resolved.stage_id = resolvedIds.stage_id;
          const nameErrors = resolveOpportunityErrors(resolved, options);
          if (nameErrors.length) {
            summary.errors += 1;
            continue;
          }
        }
        const error = validateRequired(resolved, targetType, options);
        if (error) {
          summary.errors += 1;
          continue;
        }

        const dup = await findDuplicates({ phone: resolved.phone, email: resolved.email }, client);
        if (dup && duplicateMode === 'skip') {
          summary.skipped += 1;
          continue;
        }

        if (dup && duplicateMode === 'merge') {
          await ContactModel.updateById(dup.id, {
            name: resolved.name,
            phone: resolved.phone,
            email: resolved.email,
          }, client);
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
            }, client);
            summary.updated += 1;
          } else {
            await LeadModel.createLead(payload, client);
            summary.created += 1;
          }
          continue;
        }

        if (targetType === 'opportunity') {
          const payload = buildOpportunityPayload(resolved, options, user);
          if (dup) {
            await OpportunityModel.createOpportunity({
              ...payload,
              contact_id: dup.id,
            }, client);
            summary.updated += 1;
          } else {
            await OpportunityModel.createOpportunity(payload, client);
            summary.created += 1;
          }
        }
      }
      batch.length = 0;
      logProgress(); // Log progress after each batch

      // Check for timeout
      if (Date.now() - startTime > MAX_IMPORT_TIME_MS) {
        throw new Error(`Import timeout: exceeded ${MAX_IMPORT_TIME_MS / 1000} seconds`);
      }
    };

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
        batch.push({ resolved: resolveMappedRow(row, finalMapping) });
        if (batch.length >= chunkSize) {
          await processBatch();
        }
      },
    });

    await processBatch();
    await client.query('COMMIT');

    // Final progress log
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`[CRM Import] Completed in ${elapsed.toFixed(1)}s: ${summary.total} processed, ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.errors} errors`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[CRM Import] Failed after ${(Date.now() - startTime) / 1000}s:`, err.message);
    throw err;
  } finally {
    if (shouldRelease && client?.release) {
      client.release();
    }
  }

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
