const express = require('express');
const supertest = require('supertest');

jest.mock('../models/pipeline');
jest.mock('../models/lead');
jest.mock('../models/opportunity');
jest.mock('../models/activity');
jest.mock('../models/contact');

jest.mock('../middleware/csrf', () => jest.fn((_req, _res, next) => next()));

const PipelineModel = require('../models/pipeline');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const ActivityModel = require('../models/activity');
const ContactModel = require('../models/contact');

const crmController = require('../controllers/crmController');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = { user: { id: 1, role: 'ADMIN' } };
    next();
  });
  app.post('/crm/leads', crmController.createLead);
  app.post('/crm/leads/import-csv', crmController.importLeadsCsv);
  app.post('/crm/leads/import-csv/preview', crmController.previewLeadsCsv);
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


  test('preview CSV identifica duplicados por email/telefone', async () => {
    ContactModel.findByIdentifiers.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'c1' });
    const request = createApp();
    const csv = 'name,phone,email\nAna,119,ana@test.com\nBia,118,bia@test.com';
    const res = await request.post('/crm/leads/import-csv/preview').send({ csv });
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.duplicates).toBe(1);
    expect(res.body.data.rows[1].duplicate).toBe(true);
  });

  test('import CSV pula duplicados quando skip_duplicates=true', async () => {
    ContactModel.findByIdentifiers
      .mockResolvedValueOnce({ id: 'dup1' }) // primeira linha duplicada
      .mockResolvedValueOnce(null);          // segunda linha ok
    LeadModel.createLead.mockResolvedValue({ id: 'lead-new' });
    const request = createApp();
    const csv = 'name,phone,email\nAna,119,ana@test.com\nBia,118,bia@test.com';
    const res = await request.post('/crm/leads/import-csv').send({ csv, skip_duplicates: true });
    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.skipped).toBe(1);
    expect(LeadModel.createLead).toHaveBeenCalledTimes(1);
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
