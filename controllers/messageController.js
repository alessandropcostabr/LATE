// controllers/messageController.js
// Comentários em pt-BR; identificadores em inglês.

const Message = require('../models/message');
const UserModel = require('../models/user');
const SectorModel = require('../models/sector');
const UserSectorModel = require('../models/userSector');
const MessageEvent = require('../models/messageEvent');
const { sendMail } = require('../services/mailer');

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

function getViewerFromRequest(req) {
  const sessionUser = req.session?.user;
  if (!sessionUser) return null;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    viewScope: sessionUser.viewScope || sessionUser.view_scope || 'all',
  };
}

async function resolveViewerWithSectors(req) {
  if (req._viewerCache) return req._viewerCache;

  const base = getViewerFromRequest(req);
  if (!base || !Number.isInteger(Number(base.id))) {
    req._viewerCache = base;
    return base;
  }

  try {
    const sectors = await UserSectorModel.listUserSectors(base.id);
    base.sectorIds = sectors
      .map((sector) => Number(sector.id))
      .filter((id) => Number.isInteger(id) && id > 0);
  } catch (err) {
    console.warn('[viewer] falha ao carregar setores do usuário', {
      userId: base.id,
      err: err?.message || err,
    });
    base.sectorIds = [];
  }

  req._viewerCache = base;
  return base;
}

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
    const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const openUrl = `${baseUrl}/recados/${messageRow.id}`;
    const messageSnippet = (messageRow.message || '').replace(/\s+/g, ' ').slice(0, 240);
    const messageTail = (messageRow.message || '').length > 240 ? '…' : '';
    const noteText = typeof reason === 'string' ? reason.trim() : '';
    const limitedNote = noteText ? noteText.slice(0, 500) : '';

    const intro = (() => {
      if (template === 'forward') {
        if (forwardedBy) {
          return {
            text: `O recado foi encaminhado para você por ${forwardedBy}.`,
            html: `<p><strong>O recado foi encaminhado para você por ${escapeHtml(forwardedBy)}.</strong></p>`,
          };
        }
        return {
          text: 'Você recebeu um recado encaminhado para você.',
          html: '<p><strong>Você recebeu um recado encaminhado para você.</strong></p>',
        };
      }
      return {
        text: 'Você recebeu um novo recado.',
        html: '<p><strong>Você recebeu um novo recado.</strong></p>',
      };
    })();

    const textLines = [
      `Olá, ${recipientName}!`,
      '',
      intro.text,
      '',
      `Data/Hora: ${messageRow.call_date || '-'} ${messageRow.call_time || ''}`,
      `Remetente: ${messageRow.sender_name || '-'} (${messageRow.sender_phone || '—'} / ${messageRow.sender_email || '—'})`,
      `Assunto: ${messageRow.subject || '-'}`,
      `Mensagem: ${messageSnippet}${messageTail}`,
    ];

    if (limitedNote) {
      textLines.push('', `Observação do encaminhamento: ${limitedNote}`);
    }

    textLines.push('', `Abrir recado: ${openUrl}`);
    const text = textLines.join('\n');

    const htmlRecipientName = escapeHtml(recipientName);
    const htmlCallDate = escapeHtml(messageRow.call_date || '-');
    const htmlCallTime = escapeHtml(messageRow.call_time || '');
    const htmlSenderName = escapeHtml(messageRow.sender_name || '-');
    const htmlSenderPhone = escapeHtml(messageRow.sender_phone || '—');
    const htmlSenderEmail = escapeHtml(messageRow.sender_email || '—');
    const htmlSubject = escapeHtml(messageRow.subject || '-');
    const htmlMessageSnippet = escapeHtml(messageSnippet);
    const htmlMessageTail = escapeHtml(messageTail);
    const htmlOpenUrl = escapeHtml(openUrl);
    const htmlNote = limitedNote ? `<p><em>Observação do encaminhamento:</em> ${escapeHtml(limitedNote)}</p>` : '';

    const html = `
<p>Olá, ${htmlRecipientName}!</p>
${intro.html}
<ul>
  <li><strong>Data/Hora:</strong> ${htmlCallDate} ${htmlCallTime}</li>
  <li><strong>Remetente:</strong> ${htmlSenderName} (${htmlSenderPhone} / ${htmlSenderEmail})</li>
  <li><strong>Assunto:</strong> ${htmlSubject}</li>
  <li><strong>Mensagem:</strong> ${htmlMessageSnippet}${htmlMessageTail}</li>
</ul>
${htmlNote}
<p><a href="${htmlOpenUrl}">➜ Abrir recado</a></p>
`;

    const subject = template === 'forward'
      ? '[LATE] Recado encaminhado para você'
      : '[LATE] Novo recado para você';

    await sendMail({ to: recipientEmail, subject, html, text });
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

    const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const openUrl = `${baseUrl}/recados/${messageRow.id}`;
    const messageSnippet = (messageRow.message || '').replace(/\s+/g, ' ').slice(0, 240);
    const messageTail = (messageRow.message || '').length > 240 ? '…' : '';

    for (const member of members) {
      const recipientEmail = member?.email;
      if (!recipientEmail) continue;

      const recipientName = member?.name || 'colega';
      const textLines = [
        `Olá, ${recipientName}!`,
        '',
        `Um novo recado foi criado para o setor ${messageRow.recipient || '(setor)'}.`,
        '',
        `Data/Hora: ${messageRow.call_date || '-'} ${messageRow.call_time || ''}`,
        `Remetente: ${messageRow.sender_name || '-'} (${messageRow.sender_phone || '—'} / ${messageRow.sender_email || '—'})`,
        `Assunto: ${messageRow.subject || '-'}`,
        `Mensagem: ${messageSnippet}${messageTail}`,
        '',
        `Abrir recado: ${openUrl}`,
      ];

      const html = `
        <p>Olá, <strong>${escapeHtml(recipientName)}</strong>!</p>
        <p>Um novo recado foi criado para o setor <strong>${escapeHtml(messageRow.recipient || '(setor)')}</strong>.</p>
        <ul>
          <li><strong>Data/Hora:</strong> ${escapeHtml(messageRow.call_date || '-')} ${escapeHtml(messageRow.call_time || '')}</li>
          <li><strong>Remetente:</strong> ${escapeHtml(messageRow.sender_name || '-')} (${escapeHtml(messageRow.sender_phone || '—')} / ${escapeHtml(messageRow.sender_email || '—')})</li>
          <li><strong>Assunto:</strong> ${escapeHtml(messageRow.subject || '-')}</li>
          <li><strong>Mensagem:</strong> ${escapeHtml(messageSnippet)}${messageTail}</li>
        </ul>
        <p><a href="${escapeHtml(openUrl)}">➜ Abrir recado</a></p>
      `.trim();

      const subject = `[LATE] Novo recado para o setor ${messageRow.recipient || ''}`.trim();

      try {
        await sendMail({
          to: recipientEmail,
          subject,
          html,
          text: textLines.join('\n'),
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
  };
}

async function maybeAdoptSectorMessage(messageRow, sessionUser, viewer) {
  if (!messageRow) return messageRow;
  const sectorId = messageRow.recipient_sector_id ?? messageRow.recipientSectorId ?? null;
  if (!sectorId) return messageRow;

  const status = messageRow.status;
  if (status !== 'in_progress' && status !== 'resolved') {
    return messageRow;
  }

  const sessionUserId = Number(sessionUser?.id);
  const sessionUserName = String(sessionUser?.name || '').trim();
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
      order_by,
      order,
    } = req.query;

    const viewer = await resolveViewerWithSectors(req);

    const rows = await Message.list({
      limit,
      offset,
      start_date,
      end_date,
      status,
      recipient,
      order_by,
      order,
      viewer,
    });
    await attachCreatorNames(rows);

    return res.json({ success: true, data: rows.map((row) => toClient(row, viewer)) });
  } catch (err) {
    console.error('[messages] erro ao listar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao listar recados' });
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
    const row = await Message.findById(id, { viewer });
    if (!row) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
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
    data.timeline = timeline;
    data.timelineEvents = timeline;

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[messages] erro ao obter por id:', err);
    return res.status(500).json({ success: false, error: 'Falha ao obter recado' });
  }
};

// POST /api/messages
exports.create = async (req, res) => {
  try {
    const viewer = await resolveViewerWithSectors(req);
    const sessionUserId = Number(req.session?.user?.id);

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

    await notifyRecipientUser(created, { template: 'new' });
    await notifyRecipientSectorMembers(created);

    return res.status(201).json({ success: true, data: toClient(created, viewer) });
  } catch (err) {
    console.error('[messages] erro ao criar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao criar recado' });
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
    const payload = sanitizePayload(req.body);

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
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }
    let updated = await Message.findById(id, { viewer });
    await attachCreatorNames([updated]);
    updated = await maybeAdoptSectorMessage(updated, req.session?.user, viewer);
    return res.json({ success: true, data: toClient(updated, viewer) });
  } catch (err) {
    console.error('[messages] erro ao atualizar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao atualizar recado' });
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

    const current = await Message.findById(id);
    if (!current) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
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
        error: 'Selecione um destinatário diferente para encaminhar o recado.',
      });
    }

    const ok = await Message.updateRecipient(id, {
      recipient: resolved.recipient,
      recipient_user_id: newRecipientUserId,
      recipient_sector_id: newRecipientSectorId,
    });

    if (!ok) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }

    const updated = await Message.findById(id);
    await attachCreatorNames([updated]);
    const forwardNoteRaw = req.body?.forwardNote ?? req.body?.forward_note ?? req.body?.note ?? req.body?.comment;
    const forwardNote = typeof forwardNoteRaw === 'string' ? forwardNoteRaw.trim() : '';
    const forwardedBy = req.session?.user?.name || null;

    if (updated) {
      await notifyRecipientUser(updated, {
        template: 'forward',
        forwardedBy,
        reason: forwardNote,
      });
    }

    return res.json({ success: true, data: toClient(updated, viewer) });
  } catch (err) {
    console.error('[messages] erro ao encaminhar:', err);
    return res.status(500).json({ success: false, error: 'Falha ao encaminhar recado' });
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
    const { status } = req.body || {};
    const ok = await Message.updateStatus(id, status, {
      updatedBy: Number.isInteger(sessionUserId) && sessionUserId > 0 ? sessionUserId : undefined,
    });
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }
    let updated = await Message.findById(id, { viewer });
    await attachCreatorNames([updated]);
    updated = await maybeAdoptSectorMessage(updated, req.session?.user, viewer);
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
      return res.status(404).json({ success: false, error: 'Recado não encontrado' });
    }
    return res.json({ success: true, data: 'Recado removido com sucesso' });
  } catch (err) {
    console.error('[messages] erro ao remover:', err);
    return res.status(500).json({ success: false, error: 'Falha ao remover recado' });
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
