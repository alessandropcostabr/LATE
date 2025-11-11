#!/usr/bin/env node

// scripts/export-worker.js
// Inicializa o worker de exportações.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { startReportExportWorker, stopReportExportWorker } = require('../services/reportExportWorker');
const db = require('../config/database');

startReportExportWorker();

function shutdown(signal) {
  console.info(`[export-worker] sinal recebido (${signal}). Encerrando...`);
  stopReportExportWorker();
  db.end?.()
    .catch(() => {})
    .finally(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
