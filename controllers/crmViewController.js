// controllers/crmViewController.js
// Páginas simples para listar leads e oportunidades (server-side render)

const LeadModel = require('../models/lead');
const OpportunityModel = require('../models/opportunity');

function isPrivileged(role) {
  const value = String(role || '').toUpperCase();
  return value === 'ADMIN' || value === 'SUPERVISOR';
}

async function leadsPage(req, res) {
  try {
    const userId = req.session?.user?.id || null;
    const role = req.session?.user?.role || '';
    const filter = {};
    if (!isPrivileged(role) && userId) {
      filter.owner_id = userId;
    }
    const leads = await LeadModel.listLeads(filter, { limit: 100, offset: 0 });
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
    return res.render('crm-leads', {
      title: 'CRM · Leads',
      user: req.session.user || null,
      leads,
      csrfToken,
      scope: 'me',
    });
  } catch (err) {
    console.error('[web][crm-leads] erro:', err);
    return res.status(500).render('500', { title: 'Erro', user: req.session.user || null });
  }
}

async function opportunitiesPage(req, res) {
  try {
    const userId = req.session?.user?.id || null;
    const role = req.session?.user?.role || '';
    const filter = {};
    if (!isPrivileged(role) && userId) {
      filter.owner_id = userId;
    }
    const opps = await OpportunityModel.listOpportunities(filter, { limit: 100, offset: 0 });
    const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;
    return res.render('crm-opportunities', {
      title: 'CRM · Oportunidades',
      user: req.session.user || null,
      opportunities: opps,
      csrfToken,
      scope: 'me',
    });
  } catch (err) {
    console.error('[web][crm-opportunities] erro:', err);
    return res.status(500).render('500', { title: 'Erro', user: req.session.user || null });
  }
}

module.exports = {
  leadsPage,
  opportunitiesPage,
};
