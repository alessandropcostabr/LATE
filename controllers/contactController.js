// controllers/contactController.js
// Histórico de registros por contato (telefone/e-mail).

const Message = require('../models/message');
const ContactModel = require('../models/contact');
const MessageLabelModel = require('../models/messageLabel');
const UserModel = require('../models/user');
const SectorModel = require('../models/sector');
const features = require('../config/features');
const { resolveViewerWithSectors } = require('./helpers/viewer');

function normalizeIdentifier(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function buildStatusOptions() {
  return [
    { value: '', label: 'Todos' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'in_progress', label: 'Em andamento' },
    { value: 'resolved', label: 'Resolvidos' },
  ];
}

function mapRecordToView(row) {
  if (!row) return null;
  return {
    id: row.id,
    call_date: row.call_date ?? null,
    call_time: row.call_time ?? null,
    subject: row.subject ?? '(sem assunto)',
    status: row.status ?? 'pending',
    status_label: Message.STATUS_LABELS_PT?.[row.status] || row.status,
    recipient: row.recipient ?? '-',
    created_at: row.created_at ?? null,
    parent_message_id: row.parent_message_id ?? null,
    parentMessageId: row.parent_message_id ?? null,
    sender_name: row.sender_name ?? null,
    sender_email: row.sender_email ?? null,
    sender_phone: row.sender_phone ?? null,
  };
}

async function loadFilterOptions(viewer) {
  const [labels, users, sectors] = await Promise.all([
    MessageLabelModel.listDistinct({ limit: 200, viewer }),
    UserModel.getActiveUsersSelect(),
    SectorModel.list({ status: 'active', limit: 200 }),
  ]);
  return {
    labelOptions: labels || [],
    userOptions: users || [],
    sectorOptions: sectors?.data || [],
  };
}

exports.showHistory = async (req, res) => {
  try {
    const viewer = await resolveViewerWithSectors(req);
    let phone = normalizeIdentifier(req.params.sender_phone);
    // Se o parâmetro phone é 'email', significa que é busca apenas por email
    if (phone === 'email') {
      phone = '';
    }
    const email = normalizeIdentifier(req.query.email);
    const {
      status = '',
      label = '',
      recipient = '',
      recipient_sector_id,
      recipientSectorId,
    } = req.query || {};

    const records = await Message.listContactHistory({
      phone,
      email,
      viewer,
      status,
      label,
      labels: Array.isArray(req.query?.labels) ? req.query.labels : undefined,
      recipient,
      sectorId: recipient_sector_id ?? recipientSectorId,
      limit: 100,
    });

    const mappedRecords = records.map(mapRecordToView);

    const contact = await ContactModel.findByIdentifiers({ phone, email });
    const filterOptions = await loadFilterOptions(viewer);

    const firstRecord = mappedRecords[0] || null;
    const effectiveContact = contact || (firstRecord ? {
      name: firstRecord.sender_name ?? null,
      phone: phone || null,
      email: email || null,
    } : null);

    return res.render('historico-contato', {
      title: 'Histórico do Registro',
      user: req.session.user || null,
      contact: effectiveContact,
      records: mappedRecords,
      filters: {
        status: status || '',
        recipient: recipient || '',
        label: label || '',
        recipient_sector_id: recipient_sector_id ?? recipientSectorId ?? '',
      },
      statusOptions: buildStatusOptions(),
      labelOptions: filterOptions.labelOptions,
      userOptions: filterOptions.userOptions,
      sectorOptions: filterOptions.sectorOptions,
      identifier: { phone, email },
    });
  } catch (err) {
    console.error('[contacts] erro ao carregar histórico:', err);
    return res.status(500).render('500', {
      title: 'Erro ao carregar histórico',
      user: req.session.user || null,
    });
  }
};
