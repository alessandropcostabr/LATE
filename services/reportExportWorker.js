// services/reportExportWorker.js
// Worker responsável por processar exportações agendadas.

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const ReportExportModel = require('../models/reportExport');
const EventLogModel = require('../models/eventLog');
const MessageModel = require('../models/message');
const UserModel = require('../models/user');
const { enqueueTemplate } = require('./emailQueue');
const { prepareEventLogFiltersForQuery } = require('./eventLogFilters');
const { EXPORT_DIR, EXPORT_MAX_ROWS } = require('../config/exports');

const INTERVAL_MS = Math.max(5000, Number(process.env.REPORT_EXPORT_WORKER_INTERVAL_MS) || 15000);
const BATCH_SIZE = Math.max(1, Number(process.env.REPORT_EXPORT_WORKER_BATCH) || 2);

let timer = null;
let running = false;

async function ensureExportDir() {
  await fsPromises.mkdir(EXPORT_DIR, { recursive: true });
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escapeCell = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[";\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.join(';')];
  rows.forEach((row) => {
    lines.push(headers.map((key) => escapeCell(row[key])).join(';'));
  });
  return lines.join('\n');
}

async function collectEventLogs(job) {
  const filters = prepareEventLogFiltersForQuery(job.filters || {});
  const batchSize = 500;
  let cursor = null;
  const rows = [];

  while (true) {
    const result = await EventLogModel.listFiltered({
      ...filters,
      cursor,
      limit: batchSize,
    });

    const items = result.items || [];
    if (!items.length) break;

    items.forEach((item) => {
      rows.push({
        id: item.id,
        event_type: item.event_type,
        entity_type: item.entity_type,
        entity_id: item.entity_id,
        actor_user_id: item.actor_user?.id || null,
        actor_user_name: item.actor_user?.name || null,
        metadata: JSON.stringify(item.metadata || {}),
        created_at: item.created_at instanceof Date ? item.created_at.toISOString() : item.created_at,
      });
      if (rows.length > EXPORT_MAX_ROWS) {
        throw new Error(`Limite máximo de ${EXPORT_MAX_ROWS} linhas excedido. Ajuste o filtro.`);
      }
    });

    if (!result.nextCursor) break;
    const last = items[items.length - 1];
    cursor = {
      createdAt: last.created_at instanceof Date ? last.created_at : new Date(last.created_at),
      id: last.id,
    };
  }

  return rows;
}

async function collectMessages(job) {
  const rawFilters = { ...(job.filters || {}) };
  const viewer = rawFilters._viewer || null;
  delete rawFilters._viewer;

  const rows = [];
  const pageSize = 200;
  let offset = 0;

  while (true) {
    const batch = await MessageModel.list({
      ...rawFilters,
      limit: pageSize,
      offset,
      viewer,
    });

    if (!batch.length) break;

    batch.forEach((message) => {
      rows.push({
        id: message.id,
        status: message.status,
        recipient: message.recipient,
        recipient_user_id: message.recipient_user_id || null,
        recipient_sector_id: message.recipient_sector_id || null,
        sender_name: message.sender_name || null,
        sender_phone: message.sender_phone || null,
        sender_email: message.sender_email || null,
        subject: message.subject || null,
        message: message.message || null,
        notes: message.notes || null,
        visibility: message.visibility || null,
        callback_at: message.callback_at || null,
        created_at: message.created_at,
        updated_at: message.updated_at,
        created_by: message.created_by || null,
        updated_by: message.updated_by || null,
      });
      if (rows.length > EXPORT_MAX_ROWS) {
        throw new Error(`Limite máximo de ${EXPORT_MAX_ROWS} linhas excedido. Ajuste o filtro.`);
      }
    });

    if (batch.length < pageSize) break;
    offset += batch.length;
  }

  return rows;
}

async function writeFile(job, rows) {
  await ensureExportDir();
  const extension = job.format === 'json' ? 'json' : 'csv';
  const fileName = `export-${job.export_type}-${Date.now()}-${job.id}.${extension}`;
  const absolutePath = path.join(EXPORT_DIR, fileName);

  const payload = job.format === 'json'
    ? JSON.stringify(rows, null, 2)
    : toCsv(rows);

  await fsPromises.writeFile(absolutePath, payload, 'utf8');
  const stats = await fsPromises.stat(absolutePath);

  return {
    fileName,
    filePath: path.relative(process.cwd(), absolutePath),
    fileSize: stats.size,
  };
}

async function notifyUser(job) {
  try {
    const user = await UserModel.findById(job.created_by);
    const email = user?.email;
    if (!email) return;

    await enqueueTemplate({
      to: email,
      template: 'export-ready',
      data: {
        recipient_name: user?.name || 'colega',
        export_type: job.export_type,
        format: job.format,
        file_name: job.file_name,
        base_url: (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
      },
    });
  } catch (err) {
    console.warn('[exports-worker] falha ao enfileirar e-mail de exportação', err);
  }
}

async function cleanupExpired() {
  const expired = await ReportExportModel.cleanupExpiredFiles();
  for (const job of expired) {
    if (job.file_path) {
      const absolutePath = path.resolve(process.cwd(), job.file_path);
      if (absolutePath.startsWith(EXPORT_DIR) && fs.existsSync(absolutePath)) {
        await fsPromises.unlink(absolutePath).catch(() => {});
      }
    }
    await ReportExportModel.markExpired(job.id);
  }
}

async function processJob(job) {
  try {
    let rows = [];
    if (job.export_type === 'event_logs') {
      rows = await collectEventLogs(job);
    } else if (job.export_type === 'messages') {
      rows = await collectMessages(job);
    } else {
      throw new Error('Tipo de exportação desconhecido.');
    }

    const { filePath, fileName, fileSize } = await writeFile(job, rows);
    await ReportExportModel.markCompleted(job.id, { filePath, fileName, fileSize });
    await notifyUser({ ...job, file_name: fileName });
    console.info('[exports-worker] exportação concluída', { id: job.id, type: job.export_type });
  } catch (err) {
    console.error('[exports-worker] falha ao processar exportação', { id: job.id, err: err?.message || err });
    await ReportExportModel.markFailed(job.id, err?.message || 'Falha ao gerar arquivo.');
  }
}

async function processBatch() {
  if (running) return;
  running = true;
  try {
    await cleanupExpired().catch((err) => {
      console.warn('[exports-worker] falha ao limpar exportações expiradas', err);
    });
    const jobs = await ReportExportModel.pullPending(BATCH_SIZE);
    for (const job of jobs) {
      await processJob(job);
    }
  } catch (err) {
    console.error('[exports-worker] erro durante processamento', err);
  } finally {
    running = false;
  }
}

function startReportExportWorker() {
  if (timer) return;
  ReportExportModel.requeueStuckProcessing()
    .then((count) => {
      if (count > 0) {
        console.info('[exports-worker] jobs reprocessados após reinício', { count });
      }
    })
    .catch((err) => {
      console.error('[exports-worker] falha ao reprocessar jobs pendentes', err);
    });

  timer = setInterval(processBatch, INTERVAL_MS);
  processBatch().catch((err) => {
    console.error('[exports-worker] falha inicial', err);
  });
  console.info('[exports-worker] iniciado', { intervalMs: INTERVAL_MS, batchSize: BATCH_SIZE, dir: EXPORT_DIR });
}

function stopReportExportWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  ReportExportModel.requeueStuckProcessing()
    .then((count) => {
      if (count > 0) {
        console.info('[exports-worker] jobs devolvidos para fila', { count });
      }
    })
    .catch((err) => {
      console.error('[exports-worker] falha ao devolver jobs durante desligamento', err);
    });
}

module.exports = {
  startReportExportWorker,
  stopReportExportWorker,
};
