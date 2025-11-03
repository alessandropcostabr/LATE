// controllers/messageController.js
// Comentários em pt-BR; identificadores em inglês.

const Message = require('../models/message');
const UserModel = require('../models/user');
const SectorModel = require('../models/sector');
const UserSectorModel = require('../models/userSector');
const MessageEvent = require('../models/messageEvent');
const MessageLabelModel = require('../models/messageLabel');
const MessageChecklistModel = require('../models/messageChecklist');
const MessageCommentModel = require('../models/messageComment');
const MessageWatcherModel = require('../models/messageWatcher');
const { enqueueTemplate } = require('../services/emailQueue');
const { getViewerFromRequest, resolveViewerWithSectors } = require('./helpers/viewer');
const features = require('../config/features');
const ContactModel = require('../models/contact');

function normalizeRecipientId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function extractRecipientInput(body = {}) {
  return {
    type: String(body.recipientType || body.recipient_type || '').trim().toLowerCase(),
    userId: normalizeRecipientId(
      body.recipientUserId ??
      body.recipient_user_id ??
      body.recipientId ??
      body.recipient_id
    ),
    sectorId: normalizeRecipientId(body.recipientSectorId ?? body.recipient_sector_id),
  };
}

async function resolveRecipientTarget({ type, userId, sectorId }) {
  const hasUser = Number.isInteger(userId) && userId > 0;
  const hasSector = Number.isInteger(sectorId) && sectorId > 0;

  if (hasUser && hasSector) {
    return { error: 'Escolha um único destinatário (usuário ou setor).' };
  }

  const wantsSector = type === 'setor' || type === 'sector' || type === 'sect' || type === 's' || type === 'grupo';
  const wantsUser = type === 'usuario' || type === 'user' || type === 'u' || type === 'pessoa';

  if ((hasSector && !wantsUser) || wantsSector) {
    if (!hasSector) {
      return { error: 'Informe o setor destinatário.' };
    }
    const sector = await SectorModel.getById(sectorId);
    if (!sector || sector.is_active !== true) {
      return { error: 'Setor inválido ou inativo.' };
    }
    return {
      recipient: sector.name,
      recipient_user_id: null,
      recipient_sector_id: sector.id,
      kind: 'sector',
    };
  }

  if (hasUser || wantsUser) {
    if (!hasUser) {
      return { error: 'Informe o usuário destinatário.' };
    }
    const user = await UserModel.findById(userId);
    const isActive = user && (user.is_active === true || user.is_active === 1 || user.is_active === '1');
    if (!user || !isActive) {
      return { error: 'Usuário destinatário inválido ou inativo.' };
    }
    return {
      recipient: user.name,
      recipient_user_id: user.id,
      recipient_sector_id: null,
      kind: 'user',
    };
  }

  if (hasSector) {
    const sector = await SectorModel.getById(sectorId);
    if (!sector || sector.is_active !== true) {
      return { error: 'Setor inválido ou inativo.' };
    }
    return {
      recipient: sector.name,
      recipient_user_id: null,
      recipient_sector_id: sector.id,
      kind: 'sector',
    };
  }

  return { error: 'Destinatário inválido.' };
}

function sanitizePayload(body = {}) {
  const payload = { ...body };
  delete payload.recipientId;
  delete payload.recipient_id;
  delete payload.recipientName;
  delete payload.recipient_name;
  delete payload.recipientUserId;
  delete payload.recipient_user_id;
  delete payload.recipientSectorId;
  delete payload.recipient_sector_id;
  delete payload.recipientType;
  delete payload.recipient_type;
  delete payload._csrf;
  return payload;
}

function escapeHtml(value) {
  const text = String(value ?? '');
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Mapeia status -> rótulo pt-BR (mantém contrato do projeto)
const STATUS_LABELS_PT = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
};

function reportBackgroundFailure(taskName, err) {
  console.error('[messages] tarefa em segundo plano falhou', {
    task: taskName,
    err: err?.message || err,
  });
}

function dispatchBackground(taskName, fn) {
  if (process.env.NODE_ENV === 'test') {
    return Promise.resolve().then(fn).catch((err) => {
      reportBackgroundFailure(taskName, err);
    });
  }

  const runner = () => {
    Promise.resolve()
      .then(fn)
      .catch((err) => {
        reportBackgroundFailure(taskName, err);
      });
  };

  if (typeof setImmediate === 'function') {
    setImmediate(runner);
  } else {
    setTimeout(runner, 0);
  }
}

const CHANGE_FIELD_LABELS = {
  recipient: 'Destinatário',
  recipient_user_id: 'Destinatário (usuário)',
  recipient_sector_id: 'Destinatário (setor)',
  status: 'Situação',
  message: 'Mensagem',
  notes: 'Observações',
  call_date: 'Data da ligação',
  call_time: 'Hora da ligação',
  callback_at: 'Horário de retorno',
  sender_name: 'Remetente',
  sender_phone: 'Telefone',
  sender_email: 'E-mail',
  subject: 'Assunto',
  visibility: 'Visibilidade',
};

async function notifyRecipientUser(messageRow, { template = 'new', forwardedBy, reason } = {}) {
  const recipientUserId = messageRow?.recipient_user_id ?? null;
  if (!recipientUserId) return;

  try {
    const recipient = await UserModel.findById(recipientUserId);
    const recipientEmail = recipient?.email;

    if (process.env.MAIL_DEBUG === '1') {
      console.info('[MAIL:DEBUG] preparado para enviar notificação', {
        id: messageRow?.id,
        recipientUserId,
        recipientEmail,
        template,
      });
    }

    if (!recipientEmail) {
      return;
    }

    const recipientName = recipient?.name || 'colega';
    const messageSnippet = (messageRow.message || '').replace(/\s+/g, ' ').slice(0, 240);
    const messageTail = (messageRow.message || '').length > 240 ? '…' : '';
    const noteText = typeof reason === 'string' ? reason.trim() : '';
    const limitedNote = noteText ? noteText.slice(0, 500) : '';

    const templateName = template === 'forward' ? 'contact-forward' : 'contact-new';
    await enqueueTemplate({
      to: recipientEmail,
      template: templateName,
      data: {
        id: messageRow.id,
        subject: messageRow.subject || '-',
        sender_name: messageRow.sender_name || '-',
        sender_phone: messageRow.sender_phone || '—',
        sender_email: messageRow.sender_email || '—',
        message_snippet: messageSnippet + messageTail,
        recipient_name: recipientName,
        forwarded_by: forwardedBy || null,
        note: limitedNote || null,
      },
    });
    console.info('[MAIL:INFO] Notificação enviada', {
      to: recipientEmail,
      messageId: messageRow.id,
      template,
    });
  } catch (mailErr) {
    console.error('[MAIL:ERROR] Falha ao enviar notificação', {
      to: messageRow?.recipient_user_id,
      template,
      err: mailErr?.message || mailErr,
    });
  }
}

async function notifyRecipientSectorMembers(messageRow) {
  const sectorId = messageRow?.recipient_sector_id ?? null;
  if (!sectorId) return;

  try {
    const members = await UserModel.getActiveUsersBySector(sectorId);
    if (!Array.isArray(members) || members.length === 0) {
      if (process.env.MAIL_DEBUG === '1') {
        console.info('[MAIL:DEBUG] nenhum usuário ativo para setor', { sectorId, messageId: messageRow?.id });
      }
      return;
    }

    const messageSnippet = (messageRow.message || '').replace(/\s+/g, ' ').slice(0, 240);
    const messageTail = (messageRow.message || '').length > 240 ? '…' : '';

    for (const member of members) {
      const recipientEmail = member?.email;
      if (!recipientEmail) continue;

      try {
        await enqueueTemplate({
          to: recipientEmail,
          template: 'contact-new-sector',
          data: {
            id: messageRow.id,
            subject: messageRow.subject || '-',
            sender_name: messageRow.sender_name || '-',
            sender_phone: messageRow.sender_phone || '—',
            sender_email: messageRow.sender_email || '—',
            message_snippet: messageSnippet + messageTail,
            recipient_name: messageRow.recipient || '(setor)',
          },
        });

        if (process.env.MAIL_DEBUG === '1') {
          console.info('[MAIL:DEBUG] notificação de setor enviada', {
            messageId: messageRow?.id,
            sectorId,
            recipientUserId: member.id,
            recipientEmail,
          });
        }
      } catch (mailErr) {
        const reason = mailErr?.message || mailErr;
        console.error('[MAIL:ERROR] Falha ao notificar integrante do setor', {
          messageId: messageRow?.id,
          sectorId,
          recipientUserId: member.id,
          recipientEmail,
          err: reason,
        });
        try {
          await MessageEvent.create({
            message_id: messageRow.id,
            event_type: 'email_failure',
            payload: {
              email: recipientEmail,
              sector_id: sectorId,
              user_id: member.id,
              reason,
              scope: 'sector_notification',
            },
          });
        } catch (eventErr) {
          console.warn('[MAIL:WARN] falha ao registrar evento de erro de e-mail', {
            messageId: messageRow?.id,
            sectorId,
            recipientEmail,
            err: eventErr?.message || eventErr,
          });
        }
        continue;
      }
    }
  } catch (err) {
    console.error('[MAIL:ERROR] Falha ao notificar setor', {
      messageId: messageRow?.id,
      sectorId,
      err: err?.message || err,
    });
  }
}

// Função para padronizar o objeto enviado ao cliente (mantém snake_case e adiciona camelCase)
function toClient(row, viewer) {
  if (!row) return null;
  const createdBy = row.created_by ?? row.createdBy ?? null;
  const updatedBy = row.updated_by ?? row.updatedBy ?? null;
  const viewerId = Number(viewer?.id);
  const isOwner = Number.isInteger(viewerId) && viewerId > 0 && createdBy === viewerId;
  const viewerSectorIds = Array.isArray(viewer?.sectorIds) ? viewer.sectorIds : [];
  const sectorId = row.recipient_sector_id ?? row.recipientSectorId ?? null;
  const isSectorMember = Number.isInteger(viewerId) && viewerId > 0 &&
    Number.isInteger(sectorId) && viewerSectorIds.includes(Number(sectorId));
  const isRecipient = (
    Number.isInteger(viewerId) &&
    viewerId > 0 &&
    ((row.recipient_user_id ?? row.recipientUserId) === viewerId || isSectorMember)
  );

  return {
    ...row,
    recipient_user_id: row.recipient_user_id ?? null,
    recipientUserId: row.recipient_user_id ?? null,
    recipient_sector_id: row.recipient_sector_id ?? null,
    recipientSectorId: row.recipient_sector_id ?? null,
    visibility: row.visibility ?? 'private',
    // alias em camelCase para compatibilidade com JS do front
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    created_by: createdBy,
    createdBy,
    updated_by: updatedBy,
    updatedBy,
    is_owner: isOwner,
    isOwner,
    is_recipient: isRecipient,
    isRecipient,
    is_sector_member: isSectorMember,
    isSectorMember,
    created_by_name: row.created_by_name ?? null,
    createdByName: row.created_by_name ?? null,
    // rótulo amigável
    status_label: STATUS_LABELS_PT[row.status] || row.status,
    parent_message_id: row.parent_message_id ?? row.parentMessageId ?? null,
    parentMessageId: row.parent_message_id ?? row.parentMessageId ?? null,
  };
}

function toRelatedItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    call_date: row.call_date ?? null,
    callDate: row.call_date ?? null,
    subject: row.subject ?? null,
    status: row.status ?? null,
    status_label: STATUS_LABELS_PT[row.status] || row.status,
    recipient_name: row.recipient ?? null,
    recipientName: row.recipient ?? null,
    parent_message_id: row.parent_message_id ?? null,
    parentMessageId: row.parent_message_id ?? null,
    created_at: row.created_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

async function syncContactFromMessage(row) {
  if (!row) return;
  try {
    await ContactModel.updateFromMessage(row);
  } catch (err) {
    console.warn('[contacts] falha ao sincronizar contato', err?.message || err);
  }
}

async function maybeAdoptSectorMessage(messageRow, sessionUser, viewer, actor = {}) {
  if (!messageRow) return messageRow;
  const sectorId = messageRow.recipient_sector_id ?? messageRow.recipientSectorId ?? null;
  if (!sectorId) return messageRow;

  const status = messageRow.status;
  if (status !== 'in_progress' && status !== 'resolved') {
    return messageRow;
  }

  const sessionUserId = Number(sessionUser?.id);
  const sessionUserName = String(sessionUser?.name || '').trim();
  const actorId = Number.isInteger(Number(actor?.id)) ? Number(actor.id) : sessionUserId;
  const actorName = actor?.name || sessionUserName;

  if (!Number.isInteger(sessionUserId) || sessionUserId <= 0 || !sessionUserName) {
    return messageRow;
  }

  if (messageRow.recipient_user_id && messageRow.recipient_user_id !== sessionUserId) {
    return messageRow;
  }

  if (messageRow.recipient_user_id === sessionUserId && !messageRow.recipient_sector_id) {
    return messageRow;
  }

  const isMember = await UserSectorModel.isUserInSector(sessionUserId, sectorId);
  if (!isMember) {
    return messageRow;
  }

  const updated = await Message.updateRecipient(messageRow.id, {
    recipient: sessionUserName,
    recipient_user_id: sessionUserId,
    recipient_sector_id: null,
  });

  if (!updated) {
    return messageRow;
  }

  const refreshed = await Message.findById(messageRow.id, { viewer });
  await attachCreatorNames([refreshed]);
  await logMessageEvent(messageRow.id, 'adopted', {
    user_id: actorId,
    user_name: actorName,
    from_sector_id: sectorId,
    previous_user_id: messageRow.recipient_user_id,
    previous_recipient: messageRow.recipient,
  });
  return refreshed || messageRow;
}

async function attachCreatorNames(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  const ids = rows
    .map((row) => row?.created_by ?? row?.createdBy ?? null)
    .filter((id) => Number.isInteger(Number(id)) && Number(id) > 0);
  if (!ids.length) return;

  const namesMap = await UserModel.getNamesByIds(ids);
  rows.forEach((row) => {
    const creatorId = row?.created_by ?? row?.createdBy;
    if (creatorId && namesMap[creatorId]) {
      row.created_by_name = namesMap[creatorId];
    }
  });
}

function getSessionActor(req) {
  const user = req.session?.user || {};
  const id = Number(user.id);
  return {
    id: Number.isInteger(id) && id > 0 ? id : null,
    name: typeof user.name === 'string' && user.name.trim() ? user.name.trim() : null,
  };
}

async function logMessageEvent(messageId, eventType, payload = {}) {
  if (!Number.isInteger(Number(messageId)) || messageId <= 0) return;
  try {
    await MessageEvent.create({
      message_id: messageId,
      event_type: eventType,
      payload,
    });
  } catch (eventErr) {
    console.warn('[messages] falha ao registrar evento', {
      messageId,
      eventType,
      err: eventErr?.message || eventErr,
    });
  }
}

function computeChanges(before, after) {
  if (!before || !after) return [];
  const trackedFields = [
    'recipient',
    'status',
    'message',
    'notes',
    'call_date',
    'call_time',
    'callback_at',
    'sender_name',
    'sender_phone',
    'sender_email',
    'subject',
    'visibility',
  ];

  return trackedFields.reduce((acc, field) => {
    const formatValue = (value) => {
      if (value === undefined || value === null) return null;
      if (field === 'callback_at') {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
          try {
            return date.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
          } catch (err) {
            return date.toISOString();
          }
        }
      }
      return value;
    };

    const beforeValue = formatValue(before[field]);
    const afterValue = formatValue(after[field]);
    if ((beforeValue ?? null) === (afterValue ?? null)) {
      return acc;
    }
    acc.push({
      field,
      label: CHANGE_FIELD_LABELS[field] || field,
      from: beforeValue,
      to: afterValue,
    });
    return acc;
  }, []);
}

// GET /api/messages?limit&offset&start_date&end_date&status&recipient&order_by&order
exports.list = async (req, res) => {
  try {
    const {
      limit,
      offset,
      start_date,
      end_date,
      status,
      recipient,
      sector_id,
      label,
      order_by,
      order,
    } = req.query;

    const viewer = await resolveViewerWithSectors(req);
    const actor = getSessionActor(req);

    const rows = await Message.list({
      limit,
      offset,
      start_date,
      end_date,
      status,
      recipient,
      sector_id,
      label,
      order_by,
      order,
      viewer,
    });
    await attachCreatorNames(rows);

    return res.json({ success: true, data: rows.map((row) => toClient(row, viewer)) });
  } catch (err) {
    console.error('[messages] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar registros' });
  }
};

// GET /api/messages/:id
exports.getById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const viewer = await resolveViewerWithSectors(req);
    const actor = getSessionActor(req);
    const row = await Message.findById(id, { viewer });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }
    await attachCreatorNames([row]);
    const events = await MessageEvent.listByMessage(id);
    const timeline = events.map((event) => ({
      id: event.id,
      type: event.event_type,
      payload: event.payload,
      created_at: event.created_at,
    }));
    const data = toClient(row, viewer);

    const [labels, checklists, comments, watchers] = await Promise.all([
      MessageLabelModel.listByMessage(id),
      MessageChecklistModel.listByMessage(id),
      MessageCommentModel.listByMessage(id),
      MessageWatcherModel.listForMessage(id),
    ]);

    data.labels = labels;
    data.checklists = checklists;
    data.comments = comments;
    data.watchers = watchers;
    data.watchersCount = watchers.length;
    data.timeline = timeline;
    data.timelineEvents = timeline;

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[messages] erro ao obter por id:', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter registro' });
  }
};

// GET /api/messages/related
exports.listRelated = async (req, res) => {
  try {
    const viewer = await resolveViewerWithSectors(req);
    const phone = String(req.query.phone || '').trim();
    const email = String(req.query.email || '').trim();
    const limit = Number(req.query.limit) || 5;
    const excludeRaw = req.query.excludeId ?? req.query.exclude ?? req.query.exclude_id;
    const excludeId = Number.isInteger(excludeRaw) ? excludeRaw : Number(excludeRaw);
    const sanitizedExcludeId = Number.isInteger(excludeId) && excludeId > 0 ? excludeId : null;

    const related = await Message.listRelatedMessages({
      phone,
      email,
      excludeId: sanitizedExcludeId,
      limit,
      viewer,
    });

    const data = related.map(toRelatedItem);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[messages] erro ao buscar relacionados:', err);
    return res.status(500).json({ success: false, error: 'Falha ao buscar registros relacionados' });
  }
};

// POST /api/messages
exports.create = async (req, res) => {
  try {
    const viewer = await resolveViewerWithSectors(req);
    const sessionUserId = Number(req.session?.user?.id);
    const actor = getSessionActor(req);

    const recipientInput = extractRecipientInput(req.body);
    const resolved = await resolveRecipientTarget(recipientInput);
    if (resolved.error) {
      return res.status(400).json({ success: false, error: resolved.error });
    }

    const payload = sanitizePayload(req.body);
    payload.recipient = resolved.recipient;
    if (resolved.recipient_user_id !== undefined) {
      payload.recipient_user_id = resolved.recipient_user_id;
    } else {
      payload.recipient_user_id = null;
    }
    if (resolved.recipient_sector_id !== undefined) {
      payload.recipient_sector_id = resolved.recipient_sector_id;
    } else {
      payload.recipient_sector_id = null;
    }
    if (payload.visibility === undefined || payload.visibility === null || payload.visibility === '') {
      payload.visibility = 'private';
    }

    if (Number.isInteger(sessionUserId) && sessionUserId > 0) {
      payload.created_by = sessionUserId;
      payload.updated_by = sessionUserId;
    }

    const id = await Message.create(payload);
    const created = await Message.findById(id);
    await attachCreatorNames([created]);
    await syncContactFromMessage(created);

    if (created) {
      dispatchBackground('notifyRecipientUser:new', () => notifyRecipientUser(created, { template: 'new' }));
      dispatchBackground('notifyRecipientSectorMembers:new', () => notifyRecipientSectorMembers(created));
    }

    await logMessageEvent(id, 'created', {
      user_id: actor.id,
      user_name: actor.name,
    });

    return res.status(201).json({ success: true, data: toClient(created, viewer) });
  } catch (err) {
    console.error('[messages] erro ao criar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao criar registro' });
  }
};

// PUT /api/messages/:id
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const viewer = await resolveViewerWithSectors(req);
    const sessionUserId = Number(req.session?.user?.id);
    const actor = getSessionActor(req);
    const payload = sanitizePayload(req.body);
    const before = await Message.findById(id);
    if (!before) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }

    const recipientInput = extractRecipientInput(req.body);
    const shouldResolveRecipient = (
      recipientInput.userId ||
      recipientInput.sectorId ||
      recipientInput.type
    );

    if (shouldResolveRecipient) {
      const resolved = await resolveRecipientTarget(recipientInput);
      if (resolved.error) {
        return res.status(400).json({ success: false, error: resolved.error });
      }
      payload.recipient = resolved.recipient;
      if (resolved.recipient_user_id !== undefined) {
        payload.recipient_user_id = resolved.recipient_user_id;
      } else {
        payload.recipient_user_id = null;
      }
      if (resolved.recipient_sector_id !== undefined) {
        payload.recipient_sector_id = resolved.recipient_sector_id;
      } else {
        payload.recipient_sector_id = null;
      }
    }

    if (Number.isInteger(sessionUserId) && sessionUserId > 0) {
      payload.updated_by = sessionUserId;
    }

    const ok = await Message.update(id, payload);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }
    let updated = await Message.findById(id, { viewer });
    await attachCreatorNames([updated]);
    await syncContactFromMessage(updated);
    const changes = computeChanges(before, updated);

    updated = await maybeAdoptSectorMessage(updated, req.session?.user, viewer, actor);
    if (changes.length) {
      await logMessageEvent(id, 'updated', {
        user_id: actor.id,
        user_name: actor.name,
        changes,
      });
    }

    return res.json({ success: true, data: toClient(updated, viewer) });
  } catch (err) {
    console.error('[messages] erro ao atualizar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar registro' });
  }
};

// POST /api/messages/:id/forward
exports.forward = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const viewer = await resolveViewerWithSectors(req);
    const actor = getSessionActor(req);

    const current = await Message.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }

    const recipientInput = extractRecipientInput(req.body);
    const resolved = await resolveRecipientTarget(recipientInput);
    if (resolved.error) {
      return res.status(400).json({ success: false, error: resolved.error });
    }

    const newRecipientUserId = resolved.recipient_user_id ?? null;
    const newRecipientSectorId = resolved.recipient_sector_id ?? null;
    const normalizedRecipient = String(resolved.recipient || '').trim();
    const currentRecipient = String(current.recipient || '').trim();
    const sameUser = current.recipient_user_id && newRecipientUserId && current.recipient_user_id === newRecipientUserId;
    const sameSector = current.recipient_sector_id && newRecipientSectorId && current.recipient_sector_id === newRecipientSectorId;
    const unchangedRecipient = (sameUser || sameSector) && (!normalizedRecipient || normalizedRecipient === currentRecipient);

    if (unchangedRecipient) {
      return res.status(400).json({
        success: false,
        error: 'Selecione um destinatário diferente para encaminhar o registro.',
      });
    }

    const ok = await Message.updateRecipient(id, {
      recipient: resolved.recipient,
      recipient_user_id: newRecipientUserId,
      recipient_sector_id: newRecipientSectorId,
    });

    if (!ok) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }

    const updated = await Message.findById(id);
    await attachCreatorNames([updated]);
    const forwardNoteRaw = req.body?.forwardNote ?? req.body?.forward_note ?? req.body?.note ?? req.body?.comment;
    const forwardNote = typeof forwardNoteRaw === 'string' ? forwardNoteRaw.trim() : '';
    const forwardedBy = req.session?.user?.name || null;

    if (updated) {
      dispatchBackground('notifyRecipientUser:forward', () => notifyRecipientUser(updated, {
        template: 'forward',
        forwardedBy,
        reason: forwardNote,
      }));
    }

    await logMessageEvent(id, 'forwarded', {
      user_id: actor.id,
      user_name: actor.name,
      from: {
        recipient: current.recipient,
        recipient_user_id: current.recipient_user_id,
        recipient_sector_id: current.recipient_sector_id,
      },
      to: {
        recipient: updated?.recipient ?? null,
        recipient_user_id: updated?.recipient_user_id ?? null,
        recipient_sector_id: updated?.recipient_sector_id ?? null,
      },
    });

    return res.json({ success: true, data: toClient(updated, viewer) });
  } catch (err) {
    console.error('[messages] erro ao encaminhar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao encaminhar registro' });
  }
};

// PATCH /api/messages/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const viewer = await resolveViewerWithSectors(req);
    const sessionUserId = Number(req.session?.user?.id);
    const actor = getSessionActor(req);
    const { status } = req.body || {};
    const before = await Message.findById(id);
    if (!before) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado' });
    }
    const ok = await Message.updateStatus(id, status, {
      updatedBy: Number.isInteger(sessionUserId) && sessionUserId > 0 ? sessionUserId : undefined,
    });
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Contato não encontrado' });
    }
    let updated = await Message.findById(id, { viewer });
    await attachCreatorNames([updated]);
    updated = await maybeAdoptSectorMessage(updated, req.session?.user, viewer, actor);

    if ((before.status ?? null) !== (updated?.status ?? null)) {
      await logMessageEvent(id, 'status_changed', {
        user_id: actor.id,
        user_name: actor.name,
        from: before.status,
        to: updated?.status,
      });
    }

    return res.json({ success: true, data: toClient(updated, viewer) });
  } catch (err) {
    console.error('[messages] erro ao atualizar status:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar status' });
  }
};

// DELETE /api/messages/:id
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'ID inválido' });
    }
    const ok = await Message.remove(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Contato não encontrado' });
    }
    return res.json({ success: true, data: 'Registro removido com sucesso' });
  } catch (err) {
    console.error('[messages] erro ao remover:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover registro' });
  }
};

// GET /api/messages/stats (cards do dashboard)
exports.stats = async (_req, res) => {
  try {
    const s = await Message.stats();
    return res.json({
      success: true,
      data: {
        ...s,
        labels: STATUS_LABELS_PT,
      },
    });
  } catch (err) {
    console.error('[messages] erro em /stats:', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter estatísticas' });
  }
};

// GET /api/stats/by-status (pizza)
exports.statsByStatus = async (_req, res) => {
  try {
    const rows = await Message.statsByStatus();
    return res.json({
      success: true,
      data: {
        labels: rows.map(r => STATUS_LABELS_PT[r.status] || r.status),
        data: rows.map(r => r.count),
      },
    });
  } catch (err) {
    console.error('[messages] erro em /stats/by-status:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por status.' });
  }
};

// GET /api/stats/by-recipient (barras)
exports.statsByRecipient = async (_req, res) => {
  try {
    const rows = await Message.statsByRecipient({ limit: 10 });
    return res.json({
      success: true,
      data: {
        labels: rows.map(r => r.recipient),
        data: rows.map(r => r.count),
      },
    });
  } catch (err) {
    console.error('[messages] erro em /stats/by-recipient:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por destinatário.' });
  }
};

// GET /api/stats/by-month (linha)
exports.statsByMonth = async (_req, res) => {
  try {
    const rows = await Message.statsByMonth();
    // formata MM/YYYY no controller (UI espera rótulo pt-BR)
    const labels = rows.map(r => {
      const [yy, mm] = r.month.split('-');
      return `${mm}/${yy}`;
    });
    return res.json({
      success: true,
      data: {
        labels,
        data: rows.map(r => r.count),
      },
    });
  } catch (err) {
    console.error('[messages] erro ao obter estatísticas por mês:', err);
    return res.status(500).json({ success: false, error: 'Erro ao obter estatísticas por mês.' });
  }
};

exports.__internals = {
  sanitizePayload,
  extractRecipientInput,
  resolveRecipientTarget,
  notifyRecipientUser,
  notifyRecipientSectorMembers,
  logMessageEvent,
  dispatchBackground,
  attachCreatorNames,
};
