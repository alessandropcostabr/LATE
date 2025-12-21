#!/usr/bin/env node

// scripts/bench-alerts-baseline.js
// Simula o fluxo legado (N+1) do scheduler de alertas sem enviar e-mail.

const db = require('../config/database');
const Message = require('../models/message');
const MessageAlert = require('../models/messageAlert');
const UserModel = require('../models/user');

const DEFAULT_INTERVAL_HOURS = Number(process.env.BENCH_ALERTS_INTERVAL_HOURS || 99999);
const LIMIT = Math.max(1, Math.min(Number(process.env.BENCH_ALERTS_MESSAGE_LIMIT || 200), 200));

async function processPending() {
  const messages = await Message.list({ status: 'pending', limit: LIMIT });
  let lastAlertLookups = 0;
  let userLookups = 0;
  let sectorLookups = 0;

  for (const messageRow of messages) {
    await MessageAlert.getLastAlertAt(messageRow.id, 'pending');
    lastAlertLookups += 1;

    if (messageRow.recipient_user_id) {
      await UserModel.findById(messageRow.recipient_user_id);
      userLookups += 1;
    }

    if (messageRow.recipient_sector_id) {
      await UserModel.getActiveUsersBySectors([messageRow.recipient_sector_id]);
      sectorLookups += 1;
    }
  }

  return {
    scanned: messages.length,
    last_alert_lookups: lastAlertLookups,
    user_lookups: userLookups,
    sector_lookups: sectorLookups,
  };
}

async function processInProgress() {
  const messages = await Message.list({ status: 'in_progress', limit: LIMIT });
  let lastAlertLookups = 0;
  let userLookups = 0;

  for (const messageRow of messages) {
    await MessageAlert.getLastAlertAt(messageRow.id, 'in_progress');
    lastAlertLookups += 1;

    if (messageRow.recipient_user_id) {
      await UserModel.findById(messageRow.recipient_user_id);
      userLookups += 1;
    }
  }

  return {
    scanned: messages.length,
    last_alert_lookups: lastAlertLookups,
    user_lookups: userLookups,
  };
}

async function main() {
  const startedAt = new Date();
  const startNs = process.hrtime.bigint();

  const pending = await processPending();
  const inProgress = await processInProgress();

  const endNs = process.hrtime.bigint();
  const durationMs = Number(endNs - startNs) / 1e6;

  console.log(JSON.stringify({
    started_at: startedAt.toISOString(),
    duration_ms: Math.round(durationMs),
    interval_hours: DEFAULT_INTERVAL_HOURS,
    limit: LIMIT,
    pending,
    in_progress: inProgress,
  }, null, 2));
}

main()
  .then(() => db.close())
  .catch((err) => {
    console.error('[bench-alerts-baseline] falha', err);
    return db.close().catch(() => undefined).finally(() => process.exit(1));
  });
