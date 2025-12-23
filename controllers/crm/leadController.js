// controllers/crm/leadController.js

const fs = require('fs');
const ContactModel = require('../../models/contact');
const CustomFieldValueModel = require('../../models/customFieldValue');
const LeadModel = require('../../models/lead');
const PipelineModel = require('../../models/pipeline');
const CrmImportService = require('../../services/crmImportService');
const { applyOwnerScope } = require('../../utils/scope');
const { logEvent: logAuditEvent } = require('../../utils/auditLogger');
const {
  buildDiff,
  isPrivileged,
  normalizeContactInput,
  normalizeFormValue,
  parseBooleanField,
  parseImportRequest,
  parseJsonField,
  resolveViewScope,
  toCsvRow,
  validateCustomRequired,
  persistCustomFields,
} = require('./helpers');

const LEAD_ALLOWED_FIELDS = new Set([
  'pipeline_id',
  'status',
  'score',
  'notes',
  'source',
  'custom_fields',
  'name',
  'email',
  'phone',
  'contact_name',
  'contact_email',
  'contact_phone',
]);

function hasContactPayload(body = {}) {
  return ['name', 'email', 'phone', 'contact_name', 'contact_email', 'contact_phone']
    .some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function collectInvalidFields(body = {}, allowedSet) {
  return Object.keys(body).filter((key) => !allowedSet.has(key));
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

async function createLead(req, res) {
  try {
    const contact = normalizeContactInput(req.body || {});
    const customInput = req.body.custom_fields || {};
    if (!contact.phone && !contact.email) {
      return res.status(400).json({ success: false, error: 'Informe telefone ou e-mail do lead' });
    }
    const pipelineId = req.body.pipeline_id || null;
    if (!pipelineId) {
      return res.status(400).json({ success: false, error: 'Pipeline é obrigatório' });
    }
    const pipeline = await PipelineModel.getPipelineById(pipelineId);
    if (!pipeline) {
      return res.status(400).json({ success: false, error: 'Pipeline inválido' });
    }

    const payload = {
      contact,
      pipeline_id: pipelineId,
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

async function updateLead(req, res) {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const invalid = collectInvalidFields(body, LEAD_ALLOWED_FIELDS);
    if (invalid.length) {
      return res.status(400).json({ success: false, error: `Campos não permitidos: ${invalid.join(', ')}` });
    }

    const lead = await LeadModel.findById(id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || lead.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, 'pipeline_id')) {
      const value = normalizeFormValue(body.pipeline_id);
      if (!value) {
        return res.status(400).json({ success: false, error: 'Pipeline é obrigatório' });
      }
      updates.pipeline_id = value;
      const pipeline = await PipelineModel.getPipelineById(updates.pipeline_id);
      if (!pipeline) {
        return res.status(400).json({ success: false, error: 'Pipeline inválido' });
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'status')) updates.status = normalizeFormValue(body.status);
    if (Object.prototype.hasOwnProperty.call(body, 'score')) updates.score = body.score;
    if (Object.prototype.hasOwnProperty.call(body, 'notes')) updates.notes = normalizeFormValue(body.notes);
    if (Object.prototype.hasOwnProperty.call(body, 'source')) updates.source = normalizeFormValue(body.source);

    const customInput = body.custom_fields || {};
    let updated = null;
    let contactAfter = null;
    const contactBefore = await ContactModel.findById(lead.contact_id);

    if (hasContactPayload(body)) {
      const contactPayload = normalizeContactInput(body);
      if (contactPayload.name || contactPayload.phone || contactPayload.email) {
        contactAfter = await ContactModel.updateById(lead.contact_id, {
          name: contactPayload.name,
          phone: contactPayload.phone,
          email: contactPayload.email,
        });
      }
    }

    if (Object.keys(updates).length) {
      updated = await LeadModel.updateLead(id, updates);
    }

    if (Object.keys(customInput).length) {
      const existingCustomValues = await CustomFieldValueModel.listValues('lead', id);
      const missingCustom = await validateCustomRequired('lead', customInput, existingCustomValues);
      if (missingCustom.length) {
        return res.status(400).json({ success: false, error: `Campos obrigatórios: ${missingCustom.join(', ')}` });
      }
      await persistCustomFields('lead', id, customInput);
    }

    if (!updated && !contactAfter && !Object.keys(customInput).length) {
      return res.status(400).json({ success: false, error: 'Nenhuma alteração informada' });
    }

    const currentLead = updated || await LeadModel.findById(id);
    const leadDiff = buildDiff(lead, currentLead, ['pipeline_id', 'status', 'score', 'notes', 'source']);
    const contactDiff = contactBefore && contactAfter
      ? buildDiff(contactBefore, contactAfter, ['name', 'phone', 'email'], 'contact')
      : {};

    const changed = { ...leadDiff, ...contactDiff };
    if (Object.keys(changed).length) {
      await logAuditEvent('crm.lead.updated', {
        entityType: 'lead',
        entityId: id,
        actorUserId: userId || null,
        metadata: { changed },
      });
    }

    return res.json({ success: true, data: currentLead });
  } catch (err) {
    console.error('[crm] updateLead', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar lead' });
  }
}

async function deleteLead(req, res) {
  try {
    const id = req.params.id;
    const lead = await LeadModel.findById(id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || lead.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const deps = await LeadModel.dependencies(id);
    if (deps.activities > 0) {
      return res.status(409).json({ success: false, error: 'Lead possui atividades vinculadas' });
    }

    const removed = await LeadModel.softDelete(id);
    if (!removed) return res.status(404).json({ success: false, error: 'Lead não encontrado' });

    await logAuditEvent('crm.lead.deleted', {
      entityType: 'lead',
      entityId: id,
      actorUserId: userId || null,
      metadata: { dependencies: deps },
    });

    return res.json({ success: true, data: removed });
  } catch (err) {
    console.error('[crm] deleteLead', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir lead' });
  }
}

async function leadDependencies(req, res) {
  try {
    const id = req.params.id;
    const lead = await LeadModel.findById(id);
    if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || lead.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const deps = await LeadModel.dependencies(id);
    return res.json({ success: true, data: { counts: deps } });
  } catch (err) {
    console.error('[crm] leadDependencies', err);
    return res.status(500).json({ success: false, error: 'Erro ao carregar dependências' });
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
    if (err?.statusCode === 400) {
      console.warn('[crm] previewLeadsCsv', err.message);
    } else {
      console.error('[crm] previewLeadsCsv', err);
    }
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, error: err.message || 'CSV inválido' });
    }
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
    if (err?.statusCode === 400) {
      console.warn('[crm] importLeadsCsv', err.message);
    } else {
      console.error('[crm] importLeadsCsv', err);
    }
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, error: err.message || 'CSV inválido' });
    }
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
    if (err?.statusCode === 400) {
      console.warn('[crm] dryRunImportCsv', err.message);
    } else {
      console.error('[crm] dryRunImportCsv', err);
    }
    if (err?.statusCode === 400) {
      return res.status(400).json({ success: false, error: err.message || 'CSV inválido' });
    }
    return res.status(500).json({ success: false, error: 'Erro ao simular importação' });
  } finally {
    if (payload?.filePath) {
      fs.unlink(payload.filePath, () => {});
    }
  }
}

module.exports = {
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  leadDependencies,
  exportLeadsCsv,
  previewLeadsCsv,
  importLeadsCsv,
  dryRunImportCsv,
};
