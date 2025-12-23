const express = require('express');
const supertest = require('supertest');

jest.mock('../models/pipeline');
jest.mock('../models/lead');
jest.mock('../models/opportunity');
jest.mock('../models/activity');
jest.mock('../models/customField');
jest.mock('../models/customFieldValue');
jest.mock('../config/database', () => {
  const { newDb } = require('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = mem.adapters.createPg();
  const pool = new adapter.Pool();
  return {
    query: (...args) => pool.query(...args),
    prepare: (sql) => ({
      run: (params = []) => pool.query(sql, params),
      get: async (params = []) => (await pool.query(sql, params)).rows[0],
      all: async (params = []) => (await pool.query(sql, params)).rows,
    }),
    exec: async (sql) => {
      const stmts = String(sql || '')
        .split(/;(?:\s*[\r\n]+|\s*$)/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const st of stmts) await pool.query(st);
    },
  };
});

jest.mock('../middleware/csrf', () => jest.fn((_req, _res, next) => next()));

const PipelineModel = require('../models/pipeline');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const ActivityModel = require('../models/activity');
const CustomFieldModel = require('../models/customField');
const CustomFieldValueModel = require('../models/customFieldValue');

const crmController = require('../controllers/crmController');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { user: { id: 1, role: 'ADMIN' } };
    next();
  });
  app.post('/crm/leads', crmController.createLead);
  app.post('/crm/opportunities', crmController.createOpportunity);
  app.patch('/crm/opportunities/:id/stage', crmController.moveOpportunityStage);
  return supertest(app);
}

describe('CRM API', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Defaults para mocks
    PipelineModel.getStageById.mockResolvedValue(null);
    PipelineModel.getPipelineById?.mockResolvedValue({ id: 'p1' });
    PipelineModel.listPipelines?.mockResolvedValue([]);
    PipelineModel.getStages?.mockResolvedValue([]);
    LeadModel.createLead.mockResolvedValue({ id: 'lead-mock' });
    OpportunityModel.createOpportunity.mockResolvedValue({ id: 'opp-mock' });
    OpportunityModel.findById.mockResolvedValue(null);
    OpportunityModel.updateStage.mockResolvedValue({ id: 'opp-updated', stage_id: 's2' });
    ActivityModel.createActivity.mockResolvedValue({ id: 'act-mock' });
    CustomFieldModel.listRequired.mockResolvedValue([]);
    CustomFieldValueModel.listValues.mockResolvedValue([]);
    CustomFieldValueModel.upsert.mockResolvedValue();
  });

  test('criar lead exige telefone ou e-mail', async () => {
    const request = createApp();
    const res = await request.post('/crm/leads').send({ name: 'Fulana', pipeline_id: 'p1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/telefone ou e-mail/);
    expect(LeadModel.createLead).not.toHaveBeenCalled();
  });

  test('criar lead com telefone retorna sucesso', async () => {
    LeadModel.createLead.mockResolvedValue({ id: 'lead-1' });
    const request = createApp();
    const res = await request.post('/crm/leads').send({ name: 'Fulana', phone: '11999999999', pipeline_id: 'p1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('lead-1');
  });

  test('criar oportunidade exige título', async () => {
    const request = createApp();
    const res = await request.post('/crm/opportunities').send({ pipeline_id: 'p1', stage_id: 's1', phone: '119' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Título é obrigatório/);
  });

  test('criar oportunidade valida estágio', async () => {
    PipelineModel.getStageById.mockResolvedValue(null);
    const request = createApp();
    const res = await request.post('/crm/opportunities').send({
      title: 'Venda', pipeline_id: 'p1', stage_id: 's1', phone: '119'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Estágio inválido/);
  });

  test('criar oportunidade exige required_fields do estágio', async () => {
    PipelineModel.getStageById.mockResolvedValue({ id: 's1', pipeline_id: 'p1', required_fields: ['amount'], position: 1, forbid_back: false, forbid_jump: false });
    const request = createApp();
    const res = await request.post('/crm/opportunities').send({
      title: 'Venda', pipeline_id: 'p1', stage_id: 's1', phone: '119'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Campos obrigatórios/);
  });

  test('criar oportunidade válida', async () => {
    PipelineModel.getStageById.mockResolvedValue({ id: 's1', pipeline_id: 'p1', required_fields: [], position: 1, forbid_back: false, forbid_jump: false });
    OpportunityModel.createOpportunity.mockResolvedValue({ id: 'opp-1' });
    const request = createApp();
    const res = await request.post('/crm/opportunities').send({
      title: 'Venda', pipeline_id: 'p1', stage_id: 's1', phone: '119', amount: 100
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('opp-1');
  });

  test('mover estágio respeita forbid_jump', async () => {
    OpportunityModel.findById.mockResolvedValue({ id: 'o1', stage_id: 's1', pipeline_id: 'p1' });
    PipelineModel.getStageById
      .mockResolvedValueOnce({ id: 's1', pipeline_id: 'p1', position: 1, forbid_jump: true, forbid_back: false, required_fields: [] })
      .mockResolvedValueOnce({ id: 's3', pipeline_id: 'p1', position: 3, forbid_jump: false, forbid_back: false, required_fields: [] });
    const request = createApp();
    const res = await request.patch('/crm/opportunities/o1/stage').send({ stage_id: 's3' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não pode pular/);
  });

  test('mover estágio respeita forbid_back', async () => {
    OpportunityModel.findById.mockResolvedValue({ id: 'o1', stage_id: 's3', pipeline_id: 'p1' });
    PipelineModel.getStageById
      .mockResolvedValueOnce({ id: 's3', pipeline_id: 'p1', position: 3, forbid_jump: false, forbid_back: false, required_fields: [] })
      .mockResolvedValueOnce({ id: 's2', pipeline_id: 'p1', position: 2, forbid_jump: false, forbid_back: true, required_fields: [] });
    const request = createApp();
    const res = await request.patch('/crm/opportunities/o1/stage').send({ stage_id: 's2' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/não pode voltar/);
  });

  test('mover estágio exige campos obrigatórios do destino', async () => {
    OpportunityModel.findById.mockResolvedValue({ id: 'o1', stage_id: 's1', pipeline_id: 'p1', amount: null });
    PipelineModel.getStageById
      .mockResolvedValueOnce({ id: 's1', pipeline_id: 'p1', position: 1, forbid_jump: false, forbid_back: false, required_fields: [] })
      .mockResolvedValueOnce({ id: 's2', pipeline_id: 'p1', position: 2, forbid_jump: false, forbid_back: false, required_fields: ['amount'] });
    const request = createApp();
    const res = await request.patch('/crm/opportunities/o1/stage').send({ stage_id: 's2' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Campos obrigatórios/);
  });

  test('mover estágio válido', async () => {
    OpportunityModel.findById.mockResolvedValue({ id: 'o1', stage_id: 's1', pipeline_id: 'p1', amount: 100 });
    PipelineModel.getStageById
      .mockResolvedValueOnce({ id: 's1', pipeline_id: 'p1', position: 1, forbid_jump: false, forbid_back: false, required_fields: [] })
      .mockResolvedValueOnce({ id: 's2', pipeline_id: 'p1', position: 2, forbid_jump: false, forbid_back: false, required_fields: [] });
    OpportunityModel.updateStage = jest.fn().mockResolvedValue({ id: 'o1', stage_id: 's2' });
    const request = createApp();
    const res = await request.patch('/crm/opportunities/o1/stage').send({ stage_id: 's2' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stage_id).toBe('s2');
  });
});
