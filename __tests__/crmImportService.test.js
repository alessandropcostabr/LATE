const CrmImportService = require('../services/crmImportService');
const ContactModel = require('../models/contact');
const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');

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
      expect.objectContaining({ contact_id: 'dup-1', owner_id: 10 })
    );
    expect(fakeClient.query).toHaveBeenCalled();
  });
});
