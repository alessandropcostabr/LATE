// controllers/dedupController.js
// Deduplicação simples de contatos por telefone/email normalizados.

const ContactModel = require('../models/contact');
const { normalizePhone } = require('../utils/phone');
const { normalizeEmail } = require('../utils/normalizeContact');

async function listDuplicates(_req, res) {
  try {
    const data = await ContactModel.findDuplicates({ limit: 100 });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[dedup] listDuplicates', err);
    return res.status(500).json({ success: false, error: 'Erro ao buscar duplicados' });
  }
}

async function previewMerge(req, res) {
  try {
    const phone = normalizePhone(req.body.phone || '');
    const email = normalizeEmail(req.body.email || '');
    if (!phone && !email) return res.status(400).json({ success: false, error: 'Informe telefone ou email' });
    const dup = await ContactModel.findByIdentifiers({ phone, email });
    return res.json({ success: true, data: dup ? { duplicate: true, contact: dup } : { duplicate: false } });
  } catch (err) {
    console.error('[dedup] preview', err);
    return res.status(500).json({ success: false, error: 'Erro ao buscar duplicados' });
  }
}

async function merge(req, res) {
  try {
    const source = req.body.source_id;
    const target = req.body.target_id;
    if (!source || !target) return res.status(400).json({ success: false, error: 'IDs obrigatórios' });
    await ContactModel.mergeContacts(source, target);
    return res.json({ success: true });
  } catch (err) {
    console.error('[dedup] merge', err);
    return res.status(500).json({ success: false, error: 'Erro ao mesclar contatos' });
  }
}

module.exports = {
  listDuplicates,
  previewMerge,
  merge,
};
