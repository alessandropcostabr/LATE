// services/messageAlerts.js
// Agendador para envio de alertas recorrentes de recados.

const db = require('../config/database');
const MessageAlert = require('../models/messageAlert');
const MessageEvent = require('../models/messageEvent');
const UserModel = require('../models/user');
const UserSectorModel = require('../models/userSector');
const { sendMail } = require('../services/mailer');

const ONE_HOUR = 60 * 60 * 1000;
const PENDING_INTERVAL_HOURS = Number(process.env.ALERT_PENDING_HOURS || 24);
const IN_PROGRESS_INTERVAL_HOURS = Number(process.env.ALERT_IN_PROGRESS_HOURS || 48);

function parseEmailList(rows = []) {
  return rows
    .map((row) => String(row.email || '').trim())
    .filter((email) => email);
}

function buildMessageUrl(messageId) {
  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${baseUrl}/recados/${messageId}`;
}

function formatAlertEmail({ recipientName, messageRow, intro }) {
  const link = buildMessageUrl(messageRow.id);
  const html = `
    <p>Olá, <strong>${recipientName || 'colega'}</strong>!</p>
    <p>${intro}</p>
    <ul>
      <li><strong>Assunto:</strong> ${messageRow.subject || '-'}</li>
      <li><strong>Remetente:</strong> ${messageRow.sender_name || '-'}</li>
      <li><strong>Telefone:</strong> ${messageRow.sender_phone || '-'}</li>
      <li><strong>Última atualização:</strong> ${messageRow.updated_at || '-'}</li>
    </ul>
    <p><a href="${link}">➜ Abrir recado</a></p>
  `.trim();

  const text = [
    `Olá, ${recipientName || 'colega'}!`,
    '',
    intro,
    '',
    `Assunto: ${messageRow.subject || '-'}`,
    `Remetente: ${messageRow.sender_name || '-'}`,
    `Telefone: ${messageRow.sender_phone || '-'}`,
    `Última atualização: ${messageRow.updated_at || '-'}`,
    '',
    `Abrir recado: ${link}`,
  ].join('\n');

  return { html, text };
}

async function logEvent(messageId, type, payload) {
  try {
    await MessageEvent.create({
      message_id: messageId,
      event_type: type,
      payload,
    });
  } catch (err) {
    console.warn('[alerts] falha ao registrar evento', { messageId, type, err: err?.message || err });
  }
}

async function fetchPendingMessages(hoursInterval) {
  const sql = `
    SELECT
      m.*,
      COALESCE((
        SELECT MAX(sent_at)
          FROM message_alerts ma
         WHERE ma.message_id = m.id
           AND ma.alert_type = 'pending'
      ), m.created_at) AS last_alert_at
      FROM messages m
     WHERE m.status = 'pending'
       AND COALESCE((
        SELECT MAX(sent_at)
          FROM message_alerts ma
         WHERE ma.message_id = m.id
           AND ma.alert_type = 'pending'
      ), m.created_at) <= (CURRENT_TIMESTAMP - (${hoursInterval}::int || ' hours')::interval)
     ORDER BY m.id
     LIMIT 100
  `;
  const { rows } = await db.query(sql);
  return rows || [];
}

async function fetchInProgressMessages(hoursInterval) {
  const sql = `
    SELECT
      m.*,
      COALESCE((
        SELECT MAX(sent_at)
          FROM message_alerts ma
         WHERE ma.message_id = m.id
           AND ma.alert_type = 'in_progress'
      ), m.updated_at) AS last_alert_at
      FROM messages m
     WHERE m.status = 'in_progress'
       AND COALESCE((
        SELECT MAX(sent_at)
          FROM message_alerts ma
         WHERE ma.message_id = m.id
           AND ma.alert_type = 'in_progress'
      ), m.updated_at) <= (CURRENT_TIMESTAMP - (${hoursInterval}::int || ' hours')::interval)
     ORDER BY m.id
     LIMIT 100
  `;
  const { rows } = await db.query(sql);
  return rows || [];
}

async function sendPendingAlert(messageRow) {
  if (messageRow.recipient_user_id) {
    const user = await UserModel.findById(messageRow.recipient_user_id);
    const email = String(user?.email || '').trim();
    if (!email) return false;

    const { html, text } = formatAlertEmail({
      recipientName: user?.name,
      messageRow,
      intro: 'Há um recado pendente aguardando a sua ação.',
    });
    await sendMail({
      to: email,
      subject: '[LATE] Recado pendente aguardando atendimento',
      html,
      text,
    });
    await MessageAlert.log({ message_id: messageRow.id, alert_type: 'pending' });
    await logEvent(messageRow.id, 'alert_pending', { email });
    return true;
  }

  if (messageRow.recipient_sector_id) {
    const members = await UserModel.getActiveUsersBySector(messageRow.recipient_sector_id);
    const emails = parseEmailList(members);
    if (!emails.length) return false;

    const { html, text } = formatAlertEmail({
      recipientName: 'colega',
      messageRow,
      intro: `Há um recado pendente para o setor ${messageRow.recipient || '(setor)'}.`,
    });

    for (const member of members) {
      const email = String(member.email || '').trim();
      if (!email) continue;
      await sendMail({
        to: email,
        subject: '[LATE] Recado pendente para o seu setor',
        html,
        text,
      });
      await logEvent(messageRow.id, 'alert_pending', { email, sector_id: messageRow.recipient_sector_id });
    }

    await MessageAlert.log({ message_id: messageRow.id, alert_type: 'pending' });
    return true;
  }

  return false;
}

async function sendInProgressAlert(messageRow) {
  const userId = messageRow.recipient_user_id;
  if (!userId) return false;
  const user = await UserModel.findById(userId);
  const email = String(user?.email || '').trim();
  if (!email) return false;

  const { html, text } = formatAlertEmail({
    recipientName: user?.name,
    messageRow,
    intro: 'Este recado está em andamento há algum tempo. Confira o andamento e atualize o status, se possível.',
  });

  await sendMail({
    to: email,
    subject: '[LATE] Recado em andamento aguardando atualização',
    html,
    text,
  });

  await MessageAlert.log({ message_id: messageRow.id, alert_type: 'in_progress' });
  await logEvent(messageRow.id, 'alert_in_progress', { email });
  return true;
}

async function runAlertCycle() {
  try {
    const pendingMessages = await fetchPendingMessages(PENDING_INTERVAL_HOURS);
    for (const messageRow of pendingMessages) {
      await sendPendingAlert(messageRow);
    }

    const inProgressMessages = await fetchInProgressMessages(IN_PROGRESS_INTERVAL_HOURS);
    for (const messageRow of inProgressMessages) {
      await sendInProgressAlert(messageRow);
    }
  } catch (err) {
    console.error('[alerts] erro ao processar ciclo de alertas', err);
  }
}

let schedulerStarted = false;

function startAlertScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const intervalMinutes = Number(process.env.ALERT_CHECK_INTERVAL_MINUTES || 60);
  const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

  setTimeout(runAlertCycle, 5_000);
  setInterval(runAlertCycle, intervalMs);
  console.info(`[alerts] agendador iniciado (a cada ${intervalMs / ONE_HOUR}h)`);
}

module.exports = {
  startAlertScheduler,
};
