// controllers/recadoSyncController.js
// Idempotente: cria activities a partir de recados ainda não vinculados.

const RecadoSync = require('../models/recadoSync');
const ContactModel = require('../models/contact');
const ActivityModel = require('../models/activity');

async function sync(req, res) {
  try {
    const recados = await RecadoSync.listUnmapped(200);
    let created = 0;
    for (const r of recados) {
      const contact = await ContactModel.updateFromMessage({
        sender_name: r.sender_name,
        sender_phone: r.sender_phone,
        sender_email: r.sender_email,
      });
      if (!contact) continue;
      const subject = `Recado #${r.id}`;
      const location = `recado:${r.id}`;
      await ActivityModel.createActivity({
        type: 'task',
        subject,
        starts_at: r.created_at,
        ends_at: null,
        owner_id: req.session?.user?.id || null,
        related_type: 'contact',
        related_id: contact.id,
        status: 'pending',
        location,
      });
      created += 1;
    }
    return res.json({ success: true, data: { processed: recados.length, created } });
  } catch (err) {
    console.error('[crm] sync recados -> activities', err);
    return res.status(500).json({ success: false, error: 'Erro ao sincronizar recados' });
  }
}

module.exports = { sync };
