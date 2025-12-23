// controllers/crm/opportunityController.js

const ContactModel = require('../../models/contact');
const OpportunityModel = require('../../models/opportunity');
const PipelineModel = require('../../models/pipeline');
const CustomFieldValueModel = require('../../models/customFieldValue');
const { applyOwnerScope } = require('../../utils/scope');
const { logEvent: logAuditEvent } = require('../../utils/auditLogger');
const {
  applyAutoActions,
  buildDiff,
  combineData,
  isPrivileged,
  isUuid,
  normalizeContactInput,
  persistCustomFields,
  resolveViewScope,
  scheduleStageSla,
  toCsvRow,
  validateOpportunityRequired,
} = require('./helpers');

const OPPORTUNITY_ALLOWED_FIELDS = new Set([
  'title',
  'amount',
  'close_date',
  'source',
  'description',
  'probability_override',
  'custom_fields',
  'name',
  'email',
  'phone',
  'contact_name',
  'contact_email',
  'contact_phone',
]);

function collectInvalidFields(body = {}, allowedSet) {
  return Object.keys(body).filter((key) => !allowedSet.has(key));
}

function hasContactPayload(body = {}) {
  return ['name', 'email', 'phone', 'contact_name', 'contact_email', 'contact_phone']
    .some((key) => Object.prototype.hasOwnProperty.call(body, key));
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
    if (!isPrivileged(role) && (!userId || opp.owner_id !== userId)) {
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

async function updateOpportunity(req, res) {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const invalid = collectInvalidFields(body, OPPORTUNITY_ALLOWED_FIELDS);
    if (invalid.length) {
      return res.status(400).json({ success: false, error: `Campos não permitidos: ${invalid.join(', ')}` });
    }

    const opp = await OpportunityModel.findById(id);
    if (!opp) return res.status(404).json({ success: false, error: 'Oportunidade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || opp.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(body, 'title')) updates.title = (body.title || '').trim();
    if (Object.prototype.hasOwnProperty.call(body, 'amount')) updates.amount = body.amount;
    if (Object.prototype.hasOwnProperty.call(body, 'close_date')) updates.close_date = body.close_date || null;
    if (Object.prototype.hasOwnProperty.call(body, 'source')) updates.source = body.source || null;
    if (Object.prototype.hasOwnProperty.call(body, 'description')) updates.description = body.description || null;
    if (Object.prototype.hasOwnProperty.call(body, 'probability_override')) updates.probability_override = body.probability_override;

    const customInput = body.custom_fields || {};
    let updated = null;
    let contactAfter = null;
    const contactBefore = await ContactModel.findById(opp.contact_id);

    if (hasContactPayload(body)) {
      const contactPayload = normalizeContactInput(body);
      if (contactPayload.name || contactPayload.phone || contactPayload.email) {
        contactAfter = await ContactModel.updateById(opp.contact_id, {
          name: contactPayload.name,
          phone: contactPayload.phone,
          email: contactPayload.email,
        });
      }
    }

    if (Object.keys(customInput).length) {
      const existingCustomValues = isUuid(opp.id) ? await CustomFieldValueModel.listValues('opportunity', opp.id) : [];
      const stage = await PipelineModel.getStageById(opp.stage_id);
      const missing = await validateOpportunityRequired({
        stage,
        payload: combineData(opp, body),
        customInput,
        existingCustomValues,
      });
      if (missing.length) {
        return res.status(400).json({ success: false, error: `Campos obrigatórios no estágio: ${missing.join(', ')}` });
      }
      await persistCustomFields('opportunity', opp.id, customInput);
    }

    if (Object.keys(updates).length) {
      updated = await OpportunityModel.updateOpportunity(id, updates);
    }

    if (!updated && !contactAfter && !Object.keys(customInput).length) {
      return res.status(400).json({ success: false, error: 'Nenhuma alteração informada' });
    }

    const currentOpp = updated || await OpportunityModel.findById(id);
    const oppDiff = buildDiff(opp, currentOpp, ['title', 'amount', 'close_date', 'source', 'description', 'probability_override']);
    const contactDiff = contactBefore && contactAfter
      ? buildDiff(contactBefore, contactAfter, ['name', 'phone', 'email'], 'contact')
      : {};

    const changed = { ...oppDiff, ...contactDiff };
    if (Object.keys(changed).length) {
      await logAuditEvent('crm.opportunity.updated', {
        entityType: 'opportunity',
        entityId: id,
        actorUserId: userId || null,
        metadata: { changed },
      });
    }

    return res.json({ success: true, data: currentOpp });
  } catch (err) {
    console.error('[crm] updateOpportunity', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar oportunidade' });
  }
}

async function deleteOpportunity(req, res) {
  try {
    const id = req.params.id;
    const opp = await OpportunityModel.findById(id);
    if (!opp) return res.status(404).json({ success: false, error: 'Oportunidade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && (!userId || opp.owner_id !== userId)) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const deps = await OpportunityModel.dependencies(id);
    if (deps.activities > 0) {
      return res.status(409).json({ success: false, error: 'Oportunidade possui atividades vinculadas' });
    }

    const removed = await OpportunityModel.softDelete(id);
    if (!removed) return res.status(404).json({ success: false, error: 'Oportunidade não encontrada' });

    await logAuditEvent('crm.opportunity.deleted', {
      entityType: 'opportunity',
      entityId: id,
      actorUserId: userId || null,
      metadata: { dependencies: deps },
    });

    return res.json({ success: true, data: removed });
  } catch (err) {
    console.error('[crm] deleteOpportunity', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir oportunidade' });
  }
}

async function opportunityDependencies(req, res) {
  try {
    const id = req.params.id;
    const opp = await OpportunityModel.findById(id);
    if (!opp) return res.status(404).json({ success: false, error: 'Oportunidade não encontrada' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role) && opp.owner_id && opp.owner_id !== userId) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const deps = await OpportunityModel.dependencies(id);
    return res.json({ success: true, data: { counts: deps } });
  } catch (err) {
    console.error('[crm] opportunityDependencies', err);
    return res.status(500).json({ success: false, error: 'Erro ao carregar dependências' });
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

module.exports = {
  listOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  opportunityDependencies,
  moveOpportunityStage,
  exportOpportunitiesCsv,
};
