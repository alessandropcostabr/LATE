const fs = require('fs');
const path = require('path');

jest.mock('../models/lead', () => ({
  findById: jest.fn(),
  updateLead: jest.fn(),
  softDelete: jest.fn(),
  dependencies: jest.fn(),
}));
jest.mock('../models/contact', () => ({
  findById: jest.fn(),
  updateById: jest.fn(),
}));
jest.mock('../models/customFieldValue', () => ({
  listValues: jest.fn(),
}));

const LeadModel = require('../models/lead');
const ContactModel = require('../models/contact');
const CustomFieldValueModel = require('../models/customFieldValue');
const leadController = require('../controllers/crm/leadController');

function createRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn((body) => { res.body = body; return res; });
  return res;
}

describe('CRM CRUD - segurança básica', () => {
  test('rota CRM update/delete inclui CSRF', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'routes/api.js'), 'utf8');
    expect(content).toContain("const canUpdateCRM = [requireAuth, requirePermission('crm:update'), csrfProtection]");
    expect(content).toContain("const canDeleteCRM = [requireAuth, requirePermission('crm:delete'), csrfProtection]");
  });

  test('updateLead rejeita campo proibido', async () => {
    LeadModel.findById.mockResolvedValue({ id: 'lead-1', owner_id: 1, contact_id: 'contact-1' });
    ContactModel.findById.mockResolvedValue({ id: 'contact-1' });
    ContactModel.updateById.mockResolvedValue({ id: 'contact-1' });
    CustomFieldValueModel.listValues.mockResolvedValue([]);

    const req = {
      params: { id: 'lead-1' },
      body: { owner_id: 2 },
      session: { user: { id: 1, role: 'OPERATOR' } },
    };
    const res = createRes();

    await leadController.updateLead(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Campos não permitidos/);
  });
});
