// services/messageAlerts.js
// Agendador para alertar contatos pendentes e em andamento.

const db = require('../config/database');
const Message = require('../models/message');
const NotificationSettings = require('../models/notificationSettings');
const MessageAlert = require('../models/messageAlert');
const MessageEvent = require('../models/messageEvent');
const UserModel = require('../models/user');
const { enqueueTemplate } = require('./emailQueue');

const ONE_MINUTE = 60 * 1000;
const DEFAULT_CHECK_INTERVAL_MIN = 60;
const DEFAULT_LOCK_KEY = 482901;
const BENCH_VERBOSE = ['1', 'true', 'yes', 'on'].includes(String(process.env.BENCH_ALERTS_VERBOSE || '').toLowerCase());

function benchLog(...args) {
  if (BENCH_VERBOSE) {
    console.info('[bench-alerts]', ...args);
  }
}

function getLockKey() {
  const raw = Number(process.env.ALERT_SCHEDULER_LOCK_KEY);
  return Number.isInteger(raw) && raw !== 0 ? raw : DEFAULT_LOCK_KEY;
}

function buildTemplateData(messageRow) {
  const snippet = (messageRow.message || '').replace(/\s+/g, ' ').slice(0, 240);
  return {
    id: messageRow.id,
    subject: messageRow.subject || '-',
    sender_name: messageRow.sender_name || '-',
    sender_phone: messageRow.sender_phone || '—',
    sender_email: messageRow.sender_email || '—',
    updated_at: messageRow.updated_at,
    message_snippet: snippet,
  };
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
  if (!settings.pending_enabled) {
    return { scanned: 0, notified: 0, skipped: true };
  }
  benchLog('pending: inicio');
  const messages = await Message.list({
    status: 'pending',
    limit: 200,
  });
  benchLog(`pending: mensagens=${messages.length}`);

  const messageIds = messages.map((messageRow) => messageRow.id);
  const userIds = messages.map((messageRow) => messageRow.recipient_user_id).filter(Boolean);
  const sectorIds = messages.map((messageRow) => messageRow.recipient_sector_id).filter(Boolean);
  const lastAlerts = await MessageAlert.getLastAlertsByType(messageIds, 'pending');
  const usersById = await UserModel.getUsersByIds(userIds);
  const sectorMembers = await UserModel.getActiveUsersBySectors(sectorIds);

  const now = Date.now();
  let notified = 0;
  let scanned = 0;
  for (const messageRow of messages) {
    scanned += 1;
    if (scanned % 50 === 0) benchLog(`pending: processados=${scanned}`);
    const last = lastAlerts[messageRow.id] || null;
    const lastMs = last ? new Date(last).getTime() : new Date(messageRow.created_at).getTime();
    if (Number.isNaN(lastMs) || now - lastMs >= settings.pending_interval_hours * ONE_MINUTE * 60) {
      if (messageRow.recipient_user_id) {
        const user = usersById[messageRow.recipient_user_id];
        const email = user?.email?.trim();
        if (!email) continue;
        const templateData = {
          ...buildTemplateData(messageRow),
          recipient_name: user?.name || 'colega',
        };
        try {
          await enqueueTemplate({
            to: email,
            template: 'contact-pending',
            data: templateData,
          });
          await logAlert(messageRow.id, 'pending', { email });
          notified += 1;
        } catch (err) {
          const reason = err?.message || err;
          console.error('[alerts] falha ao enviar alerta pendente', { messageId: messageRow.id, email, err: reason });
          await logAlertFailure(messageRow.id, 'pending_alert', { email, reason });
        }
      } else if (messageRow.recipient_sector_id) {
        const members = sectorMembers[messageRow.recipient_sector_id] || [];
        const recipients = members.map((m) => m.email?.trim()).filter(Boolean);
        if (!recipients.length) continue;
        const templateData = {
          ...buildTemplateData(messageRow),
          recipient_name: messageRow.recipient || '(setor)',
        };
        for (const email of recipients) {
          try {
            await enqueueTemplate({
              to: email,
              template: 'contact-pending-sector',
              data: templateData,
            });
            await logAlert(messageRow.id, 'pending', { email, sector_id: messageRow.recipient_sector_id });
            notified += 1;
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
  benchLog(`pending: finalizado scanned=${scanned} notified=${notified}`);
  return { scanned: messages.length, notified };
}

async function alertEmAndamento(settings) {
  if (!settings.in_progress_enabled) {
    return { scanned: 0, notified: 0, skipped: true };
  }
  benchLog('in_progress: inicio');
  const messages = await Message.list({ status: 'in_progress', limit: 200 });
  benchLog(`in_progress: mensagens=${messages.length}`);
  const messageIds = messages.map((messageRow) => messageRow.id);
  const userIds = messages.map((messageRow) => messageRow.recipient_user_id).filter(Boolean);
  const lastAlerts = await MessageAlert.getLastAlertsByType(messageIds, 'in_progress');
  const usersById = await UserModel.getUsersByIds(userIds);
  const now = Date.now();
  let notified = 0;
  let scanned = 0;

  for (const messageRow of messages) {
    scanned += 1;
    if (scanned % 50 === 0) benchLog(`in_progress: processados=${scanned}`);
    if (!messageRow.recipient_user_id) continue;

    const last = lastAlerts[messageRow.id] || null;
    const lastMs = last ? new Date(last).getTime() : new Date(messageRow.updated_at).getTime();
    if (Number.isNaN(lastMs) || now - lastMs >= settings.in_progress_interval_hours * ONE_MINUTE * 60) {
      const user = usersById[messageRow.recipient_user_id];
      const email = user?.email?.trim();
      if (!email) continue;

      const templateData = {
        ...buildTemplateData(messageRow),
        recipient_name: user?.name || 'colega',
      };

      try {
        await enqueueTemplate({
          to: email,
          template: 'contact-in-progress',
          data: templateData,
        });
        await logAlert(messageRow.id, 'in_progress', { email });
        notified += 1;
      } catch (err) {
        const reason = err?.message || err;
        console.error('[alerts] falha ao enviar alerta em andamento', { messageId: messageRow.id, email, err: reason });
        await logAlertFailure(messageRow.id, 'in_progress_alert', { email, reason });
      }
    }
  }
  benchLog(`in_progress: finalizado scanned=${scanned} notified=${notified}`);
  return { scanned: messages.length, notified };
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
      benchLog('lock: ocupado, ciclo ignorado');
      return { skipped: true };
    }
    return await task();
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

async function runAlertCycle(options = {}) {
  const start = Date.now();
  benchLog('ciclo: inicio');
  const runTask = async () => {
    let settings;
    if (options.settingsOverride) {
      settings = options.settingsOverride;
      benchLog('settings: override');
    } else {
      benchLog('settings: inicio');
      settings = await NotificationSettings.getSettings();
      benchLog('settings: ok');
    }
    const pending = await alertPendentes(settings);
    const inProgress = await alertEmAndamento(settings);
    const elapsedMs = Date.now() - start;
    benchLog(`ciclo: fim (${elapsedMs}ms)`);
    return { pending, in_progress: inProgress };
  };

  if (options.skipLock) {
    benchLog('lock: skip');
    return runTask();
  }

  return withSchedulerLock(runTask);
}

function startAlertScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const intervalMinutes = Math.max(5, Number(process.env.ALERT_CHECK_INTERVAL_MINUTES || DEFAULT_CHECK_INTERVAL_MIN));

  const run = async () => {
    try {
      await runAlertCycle();
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
  runAlertCycle,
};
