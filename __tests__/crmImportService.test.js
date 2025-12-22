const CrmImportService = require('../services/crmImportService');
const ContactModel = require('../models/contact');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');
const PipelineModel = require('../models/pipeline');

jest.mock('../models/contact', () => ({
  findByAnyIdentifier: jest.fn(),
  updateById: jest.fn(),
}));

jest.mock('../models/lead', () => ({
  createLead: jest.fn(),
}));

jest.mock('../models/opportunity', () => ({
  createOpportunity: jest.fn(),
}));

jest.mock('../models/pipeline', () => ({
  listPipelines: jest.fn(),
  getStages: jest.fn(),
}));

describe('CrmImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('previewCsv auto-mapeia colunas e marca duplicados', async () => {
    const csv = 'Nome,Email,Telefone\nAlice,alice@example.com,119999\nBob,bob@example.com,119888\n';
    ContactModel.findByAnyIdentifier
      .mockResolvedValueOnce({ id: 'dup-1' })
      .mockResolvedValueOnce(null);

    const data = await CrmImportService.previewCsv({ csv, targetType: 'lead', limit: 2 });

    expect(data.total).toBe(2);
    expect(data.duplicates).toBe(1);
    expect(data.mapping).toMatchObject({
      nome: 'name',
      email: 'email',
      telefone: 'phone',
    });
    expect(data.rows[0].duplicate).toBe(true);
  });

  test('dryRunImport respeita duplicate_mode=skip', async () => {
    const csv = 'name,email,phone\nAlice,alice@example.com,119999\nBob,bob@example.com,119888\n';
    ContactModel.findByAnyIdentifier
      .mockResolvedValueOnce({ id: 'dup-1' })
      .mockResolvedValueOnce(null);

    const data = await CrmImportService.dryRunImport({
      csv,
      targetType: 'lead',
      options: { duplicate_mode: 'skip' },
    });

    expect(data.total).toBe(2);
    expect(data.skipped).toBe(1);
    expect(data.created).toBe(1);
  });

  test('applyImport cria lead com contact_id quando duplicado', async () => {
    const csv = 'name,email,phone\nAlice,alice@example.com,119999\n';
    ContactModel.findByAnyIdentifier.mockResolvedValueOnce({ id: 'dup-1' });
    const fakeClient = {
      query: jest.fn().mockResolvedValue({}),
      release: jest.fn(),
    };

    const result = await CrmImportService.applyImport({
      csv,
      targetType: 'lead',
      options: { duplicate_mode: 'merge' },
      user: { id: 10 },
      dbClient: fakeClient,
    });

    expect(result.updated).toBe(1);
    expect(LeadModel.createLead).toHaveBeenCalledWith(
      expect.objectContaining({ contact_id: 'dup-1', owner_id: 10 }),
      fakeClient
    );
    expect(fakeClient.query).toHaveBeenCalled();
  });

  test('dryRunImport resolve pipeline e estágio por nome em oportunidades', async () => {
    const csv = 'title,pipeline_name,stage_name,phone,email\nTeste,Clinica,Lead,119999,teste@example.com\n';
    PipelineModel.listPipelines.mockResolvedValueOnce([{ id: 'pipe-1', name: 'Clinica' }]);
    PipelineModel.getStages.mockResolvedValueOnce([{ id: 'stage-1', name: 'Lead' }]);

    const data = await CrmImportService.dryRunImport({
      csv,
      targetType: 'opportunity',
      options: {},
    });

    expect(data.errors).toBe(0);
    expect(data.items[0].data.pipeline_id).toBe('pipe-1');
    expect(data.items[0].data.stage_id).toBe('stage-1');
  });

  test('dryRunImport reporta erro quando pipeline não existe', async () => {
    const csv = 'title,pipeline_name,stage_name,phone,email\nTeste,Inexistente,Lead,119999,teste@example.com\n';
    PipelineModel.listPipelines.mockResolvedValueOnce([]);
    PipelineModel.getStages.mockResolvedValueOnce([]);

    const data = await CrmImportService.dryRunImport({
      csv,
      targetType: 'opportunity',
      options: {},
    });

    expect(data.errors).toBe(1);
    expect(data.items[0].error).toMatch(/Pipeline não encontrado/);
  });

  test('dryRunImport reporta erro quando etapa não existe', async () => {
    const csv = 'title,pipeline_name,stage_name,phone,email\nTeste,Clinica,Inexistente,119999,teste@example.com\n';
    PipelineModel.listPipelines.mockResolvedValueOnce([{ id: 'pipe-1', name: 'Clinica' }]);
    PipelineModel.getStages.mockResolvedValueOnce([]);

    const data = await CrmImportService.dryRunImport({
      csv,
      targetType: 'opportunity',
      options: {},
    });

    expect(data.errors).toBe(1);
    expect(data.items[0].error).toMatch(/Etapa não encontrada/);
  });

  test('applyImport em paralelo não compartilha estado entre execuções', async () => {
    const csv = 'name,email,phone\nAlice,alice@example.com,119999\nBob,bob@example.com,119888\n';
    ContactModel.findByAnyIdentifier.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return null;
    });
    const fakeClient = {
      query: jest.fn().mockResolvedValue({}),
      release: jest.fn(),
    };

    const [resultA, resultB] = await Promise.all([
      CrmImportService.applyImport({
        csv,
        targetType: 'lead',
        options: { duplicate_mode: 'merge' },
        user: { id: 10 },
        dbClient: fakeClient,
      }),
      CrmImportService.applyImport({
        csv,
        targetType: 'lead',
        options: { duplicate_mode: 'merge' },
        user: { id: 11 },
        dbClient: fakeClient,
      }),
    ]);

    expect(resultA.created).toBe(2);
    expect(resultB.created).toBe(2);
    expect(LeadModel.createLead).toHaveBeenCalledTimes(4);
    expect(fakeClient.query).toHaveBeenCalled();
  });
});
