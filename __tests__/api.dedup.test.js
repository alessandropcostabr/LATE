const express = require('express');
const supertest = require('supertest');

jest.mock('../models/contact');
const ContactModel = require('../models/contact');
const dedupController = require('../controllers/dedupController');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.session = { user: { id: 1, role: 'ADMIN' } }; next(); });
  app.get('/crm/dedupe/contacts', dedupController.listDuplicates);
  app.post('/crm/dedupe/contacts/merge', dedupController.merge);
  return supertest(app);
}

describe('CRM dedup', () => {
  beforeEach(() => jest.resetAllMocks());

  test('lista duplicados', async () => {
    ContactModel.findDuplicates.mockResolvedValue([{ phone_normalized: '5511', ids: ['a','b'], total: 2 }]);
    const request = createApp();
    const res = await request.get('/crm/dedupe/contacts');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].ids).toContain('a');
  });

  test('merge chama modelo', async () => {
    ContactModel.mergeContacts.mockResolvedValue(true);
    const request = createApp();
    const res = await request.post('/crm/dedupe/contacts/merge').send({ source_id: 'a', target_id: 'b' });
    expect(res.status).toBe(200);
    expect(ContactModel.mergeContacts).toHaveBeenCalledWith('a', 'b');
  });
});
