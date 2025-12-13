const express = require('express');
const supertest = require('supertest');

jest.mock('../models/pipeline');
jest.mock('../models/lead');
jest.mock('../models/opportunity');
jest.mock('../models/activity');

jest.mock('../middleware/csrf', () => jest.fn((_req, _res, next) => next()));

const PipelineModel = require('../models/pipeline');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const ActivityModel = require('../models/activity');

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
  });

  test('criar lead exige telefone ou e-mail', async () => {
    const request = createApp();
    const res = await request.post('/crm/leads').send({ name: 'Fulana' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/telefone ou e-mail/);
    expect(LeadModel.createLead).not.toHaveBeenCalled();
  });

  test('criar lead com telefone retorna sucesso', async () => {
    LeadModel.createLead.mockResolvedValue({ id: 'lead-1' });
    const request = createApp();
    const res = await request.post('/crm/leads').send({ name: 'Fulana', phone: '11999999999' });
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


  test('mover estágio aciona auto_actions', async () => {
    OpportunityModel.findById.mockResolvedValue({ id: 'o1', stage_id: 's1', pipeline_id: 'p1', amount: 100, owner_id: 1, title: 'Venda' });
    PipelineModel.getStageById
      .mockResolvedValueOnce({ id: 's1', pipeline_id: 'p1', position: 1, forbid_jump: false, forbid_back: false, required_fields: [] })
      .mockResolvedValueOnce({ id: 's2', pipeline_id: 'p1', position: 2, forbid_jump: false, forbid_back: false, required_fields: [], auto_actions: [ { type: 'create_activity', subject: 'Auto task' } ], sla_minutes: 10 });
    ActivityModel.createActivity.mockResolvedValue({ id: 'act1' });
    OpportunityModel.updateStage = jest.fn().mockResolvedValue({ id: 'o1', stage_id: 's2' });
    const request = createApp();
    const res = await request.patch('/crm/opportunities/o1/stage').send({ stage_id: 's2' });
    expect(res.status).toBe(200);
    expect(ActivityModel.createActivity).toHaveBeenCalled();
    expect(OpportunityModel.updateStage).toHaveBeenCalled();
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
