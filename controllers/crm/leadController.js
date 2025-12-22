// controllers/crm/leadController.js

const fs = require('fs');
const LeadModel = require('../../models/lead');
const CrmImportService = require('../../services/crmImportService');
const { applyOwnerScope } = require('../../utils/scope');
const {
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
  exportLeadsCsv,
  previewLeadsCsv,
  importLeadsCsv,
  dryRunImportCsv,
};
