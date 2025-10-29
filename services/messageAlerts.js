// services/messageAlerts.js
// Agendador para alertar contatos pendentes e em andamento.

const db = require('../config/database');
const Message = require('../models/message');
const NotificationSettings = require('../models/notificationSettings');
const MessageAlert = require('../models/messageAlert');
const MessageEvent = require('../models/messageEvent');
const UserModel = require('../models/user');
const { sendMail } = require('./mailer');

const ONE_MINUTE = 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MIN = 60;
const DEFAULT_LOCK_KEY = 482901;

function getLockKey() {
  const raw = Number(process.env.ALERT_SCHEDULER_LOCK_KEY);
  return Number.isInteger(raw) && raw !== 0 ? raw : DEFAULT_LOCK_KEY;
}

function buildContatoUrl(id) {
  const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/recados/${id}`;
}

function formatEmail({ name, messageRow, intro }) {
  const link = buildContatoUrl(messageRow.id);
  const html = `
    <p>Olá, <strong>${name || 'colega'}</strong>!</p>
    <p>${intro}</p>
    <ul>
      <li><strong>Assunto:</strong> ${messageRow.subject || '-'}</li>
      <li><strong>Remetente:</strong> ${messageRow.sender_name || '-'}</li>
      <li><strong>Telefone:</strong> ${messageRow.sender_phone || '-'}</li>
      <li><strong>Última atualização:</strong> ${messageRow.updated_at || '-'}</li>
    </ul>
    <p><a href="${link}">➜ Abrir contato</a></p>
  `.trim();

  const text = [
    `Olá, ${name || 'colega'}!`,
    '',
    intro,
    '',
    `Assunto: ${messageRow.subject || '-'}`,
    `Remetente: ${messageRow.sender_name || '-'}`,
    `Telefone: ${messageRow.sender_phone || '-'}`,
    `Última atualização: ${messageRow.updated_at || '-'}`,
    '',
    `Abrir contato: ${link}`,
  ].join('\n');

  return { html, text };
}

async function logAlert(messageId, type, payload) {
  try {
    await MessageAlert.log({ message_id: messageId, alert_type: type });
  } catch (err) {
    console.warn('[alerts] falha ao registrar controle de alerta', err);
  }
  try {
    await MessageEvent.create({
      message_id: messageId,
      event_type: type === 'pending' ? 'alert_pending' : 'alert_in_progress',
      payload,
    });
  } catch (err) {
    console.warn('[alerts] falha ao registrar evento', err);
  }
}

async function logAlertFailure(messageId, scope, payload = {}) {
  try {
    await MessageEvent.create({
      message_id: messageId,
      event_type: 'email_failure',
      payload: {
        ...payload,
        scope,
      },
    });
  } catch (err) {
    console.warn('[alerts] falha ao registrar evento de erro', err);
  }
}

async function alertPendentes(settings) {
  if (!settings.pending_enabled) return;
  const messages = await Message.list({
    status: 'pending',
    limit: 200,
  });

  const now = Date.now();
  for (const messageRow of messages) {
    const last = await MessageAlert.getLastAlertAt(messageRow.id, 'pending');
    const lastMs = last ? new Date(last).getTime() : new Date(messageRow.created_at).getTime();
    if (Number.isNaN(lastMs) || now - lastMs >= settings.pending_interval_hours * ONE_MINUTE * 60) {
      if (messageRow.recipient_user_id) {
        const user = await UserModel.findById(messageRow.recipient_user_id);
        const email = user?.email?.trim();
        if (!email) continue;
        const { html, text } = formatEmail({
          name: user?.name,
          messageRow,
          intro: 'Há um contato pendente aguardando retorno.',
        });
        try {
          await sendMail({
            to: email,
            subject: '[LATE] Contato pendente aguardando atendimento',
            html,
            text,
          });
          await logAlert(messageRow.id, 'pending', { email });
        } catch (err) {
          const reason = err?.message || err;
          console.error('[alerts] falha ao enviar alerta pendente', { messageId: messageRow.id, email, err: reason });
          await logAlertFailure(messageRow.id, 'pending_alert', { email, reason });
        }
      } else if (messageRow.recipient_sector_id) {
        const members = await UserModel.getActiveUsersBySector(messageRow.recipient_sector_id);
        const recipients = members.map((m) => m.email?.trim()).filter(Boolean);
        if (!recipients.length) continue;
        const { html, text } = formatEmail({
          name: 'colega',
          messageRow,
          intro: `Há um contato pendente para o setor ${messageRow.recipient || '(setor)'}.`,
        });
        for (const email of recipients) {
          try {
            await sendMail({
              to: email,
              subject: '[LATE] Contato pendente para o seu setor',
              html,
              text,
            });
            await logAlert(messageRow.id, 'pending', { email, sector_id: messageRow.recipient_sector_id });
          } catch (err) {
            const reason = err?.message || err;
            console.error('[alerts] falha ao enviar alerta pendente de setor', {
              messageId: messageRow.id,
              sectorId: messageRow.recipient_sector_id,
              email,
              err: reason,
            });
            await logAlertFailure(messageRow.id, 'pending_alert_sector', {
              email,
              sector_id: messageRow.recipient_sector_id,
              reason,
            });
          }
        }
      }
    }
  }
}

async function alertEmAndamento(settings) {
  if (!settings.in_progress_enabled) return;
  const messages = await Message.list({ status: 'in_progress', limit: 200 });
  const now = Date.now();

  for (const messageRow of messages) {
    if (!messageRow.recipient_user_id) continue;

    const last = await MessageAlert.getLastAlertAt(messageRow.id, 'in_progress');
    const lastMs = last ? new Date(last).getTime() : new Date(messageRow.updated_at).getTime();
    if (Number.isNaN(lastMs) || now - lastMs >= settings.in_progress_interval_hours * ONE_MINUTE * 60) {
      const user = await UserModel.findById(messageRow.recipient_user_id);
      const email = user?.email?.trim();
      if (!email) continue;

      const { html, text } = formatEmail({
        name: user?.name,
        messageRow,
        intro: 'Este contato está em andamento. Atualize o status ou registre um retorno, se possível.',
      });

      try {
        await sendMail({
          to: email,
          subject: '[LATE] Contato em andamento aguardando atualização',
          html,
          text,
        });
        await logAlert(messageRow.id, 'in_progress', { email });
      } catch (err) {
        const reason = err?.message || err;
        console.error('[alerts] falha ao enviar alerta em andamento', { messageId: messageRow.id, email, err: reason });
        await logAlertFailure(messageRow.id, 'in_progress_alert', { email, reason });
      }
    }
  }
}

let schedulerStarted = false;

async function withSchedulerLock(task) {
  const client = await db.connect();
  const lockKey = getLockKey();
  let locked = false;
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [lockKey]);
    locked = rows?.[0]?.ok === true;
    if (!locked) {
      return;
    }
    await task();
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
      } catch (err) {
        console.warn('[alerts] falha ao liberar advisory lock', err);
      }
    }
    client.release();
  }
}

function startAlertScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const intervalMinutes = Math.max(5, Number(process.env.ALERT_CHECK_INTERVAL_MINUTES || DEFAULT_CHECK_INTERVAL_MIN));

  const run = async () => {
    try {
      await withSchedulerLock(async () => {
        const settings = await NotificationSettings.getSettings();
        await alertPendentes(settings);
        await alertEmAndamento(settings);
      });
    } catch (err) {
      console.error('[alerts] ciclo de alertas falhou', err);
    }
  };

  setTimeout(run, 5 * ONE_MINUTE);
  setInterval(run, intervalMinutes * ONE_MINUTE);
  console.info('[alerts] agendador iniciado');
}

module.exports = {
  startAlertScheduler,
};
