#!/usr/bin/env node

// scripts/email-worker.js
// Inicializa o worker de fila de e-mails. Usar via `npm run worker:emails`.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { startEmailQueueWorker, stopEmailQueueWorker } = require('../services/emailQueueWorker');
const db = require('../config/database');

startEmailQueueWorker();

function shutdown(signal) {
  console.info(`[email-worker] sinal recebido (${signal}). Encerrando...`);
  stopEmailQueueWorker();
  db.end?.()
    .catch(() => {})
    .finally(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
