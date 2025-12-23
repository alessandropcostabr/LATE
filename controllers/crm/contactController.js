// controllers/crm/contactController.js

const ContactModel = require('../../models/contact');
const CustomFieldValueModel = require('../../models/customFieldValue');
const { logEvent: logAuditEvent } = require('../../utils/auditLogger');
const {
  buildDiff,
  isPrivileged,
  normalizeContactInput,
  persistCustomFields,
  validateCustomRequired,
} = require('./helpers');

const CONTACT_ALLOWED_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'custom_fields',
  'contact_name',
  'contact_email',
  'contact_phone',
]);

function collectInvalidFields(body = {}, allowedSet) {
  return Object.keys(body).filter((key) => !allowedSet.has(key));
}

async function updateContact(req, res) {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const invalid = collectInvalidFields(body, CONTACT_ALLOWED_FIELDS);
    if (invalid.length) {
      return res.status(400).json({ success: false, error: `Campos não permitidos: ${invalid.join(', ')}` });
    }

    const contact = await ContactModel.findById(id);
    if (!contact) return res.status(404).json({ success: false, error: 'Contato não encontrado' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role)) {
      const owns = await ContactModel.isOwnedBy(id, userId);
      if (!owns) return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const contactPayload = normalizeContactInput(body);
    const customInput = body.custom_fields || {};

    if (Object.keys(customInput).length) {
      const existingCustomValues = await CustomFieldValueModel.listValues('contact', id);
      const missingCustom = await validateCustomRequired('contact', customInput, existingCustomValues);
      if (missingCustom.length) {
        return res.status(400).json({ success: false, error: `Campos obrigatórios: ${missingCustom.join(', ')}` });
      }
      await persistCustomFields('contact', id, customInput);
    }

    let updated = null;
    if (contactPayload.name || contactPayload.phone || contactPayload.email) {
      updated = await ContactModel.updateById(id, {
        name: contactPayload.name,
        phone: contactPayload.phone,
        email: contactPayload.email,
      });
    }

    if (!updated && !Object.keys(customInput).length) {
      return res.status(400).json({ success: false, error: 'Nenhuma alteração informada' });
    }

    const diff = updated ? buildDiff(contact, updated, ['name', 'phone', 'email']) : {};
    if (Object.keys(diff).length) {
      await logAuditEvent('crm.contact.updated', {
        entityType: 'contact',
        entityId: id,
        actorUserId: userId || null,
        metadata: { changed: diff },
      });
    }

    return res.json({ success: true, data: updated || contact });
  } catch (err) {
    console.error('[crm] updateContact', err);
    return res.status(500).json({ success: false, error: 'Erro ao atualizar contato' });
  }
}

async function deleteContact(req, res) {
  try {
    const id = req.params.id;
    const contact = await ContactModel.findById(id);
    if (!contact) return res.status(404).json({ success: false, error: 'Contato não encontrado' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role)) {
      const owns = await ContactModel.isOwnedBy(id, userId);
      if (!owns) return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const deps = await ContactModel.dependencies(id);
    const hasDeps = (deps.leads || 0) > 0 || (deps.opportunities || 0) > 0 || (deps.activities || 0) > 0;
    if (hasDeps) {
      return res.status(409).json({ success: false, error: 'Contato possui vínculos ativos' });
    }

    const removed = await ContactModel.softDelete(id);
    if (!removed) return res.status(404).json({ success: false, error: 'Contato não encontrado' });

    await logAuditEvent('crm.contact.deleted', {
      entityType: 'contact',
      entityId: id,
      actorUserId: userId || null,
      metadata: { dependencies: deps },
    });

    return res.json({ success: true, data: removed });
  } catch (err) {
    console.error('[crm] deleteContact', err);
    return res.status(500).json({ success: false, error: 'Erro ao excluir contato' });
  }
}

async function contactDependencies(req, res) {
  try {
    const id = req.params.id;
    const contact = await ContactModel.findById(id);
    if (!contact) return res.status(404).json({ success: false, error: 'Contato não encontrado' });

    const role = req.session?.user?.role || '';
    const userId = req.session?.user?.id;
    if (!isPrivileged(role)) {
      const owns = await ContactModel.isOwnedBy(id, userId);
      if (!owns) return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const deps = await ContactModel.dependencies(id);
    return res.json({ success: true, data: { counts: deps } });
  } catch (err) {
    console.error('[crm] contactDependencies', err);
    return res.status(500).json({ success: false, error: 'Erro ao carregar dependências' });
  }
}

module.exports = {
  updateContact,
  deleteContact,
  contactDependencies,
};
