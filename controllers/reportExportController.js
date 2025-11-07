// controllers/reportExportController.js
// Criação e listagem de exportações (auditoria e registros).

const path = require('path');
const fs = require('fs');

const ReportExportModel = require('../models/reportExport');
const MessageModel = require('../models/message');
const { resolveViewerWithSectors } = require('./helpers/viewer');
const { buildEventLogFilters } = require('../services/eventLogFilters');
const { EXPORT_HISTORY_LIMIT, EXPORT_DIR } = require('../config/exports');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function getSessionUser(req) {
  return req.session?.user || null;
}

function normalizeMessageFilters(raw = {}) {
  const filters = {};

  if (raw.status) {
    const normalized = MessageModel.normalizeStatus(raw.status);
    if (!normalized) {
      throw new Error('Status inválido.');
    }
    filters.status = normalized;
  }

  if (raw.start_date) {
    if (!DATE_REGEX.test(raw.start_date)) {
      throw new Error('Data inicial inválida (use YYYY-MM-DD).');
    }
    filters.start_date = raw.start_date;
  }

  if (raw.end_date) {
    if (!DATE_REGEX.test(raw.end_date)) {
      throw new Error('Data final inválida (use YYYY-MM-DD).');
    }
    if (filters.start_date && raw.end_date < filters.start_date) {
      throw new Error('Período inválido.');
    }
    filters.end_date = raw.end_date;
  }

  if (raw.recipient) {
    const value = String(raw.recipient).trim();
    if (value.length > 255) {
      throw new Error('Destinatário inválido.');
    }
    filters.recipient = value;
  }

  const allowedOrderBy = ['created_at', 'updated_at', 'id', 'status', 'date_ref', 'callback_at'];
  if (raw.order_by && allowedOrderBy.includes(String(raw.order_by))) {
    filters.order_by = String(raw.order_by);
  }

  if (raw.order) {
    const safeOrder = String(raw.order).toLowerCase() === 'asc' ? 'asc' : 'desc';
    filters.order = safeOrder;
  }

  return filters;
}

async function requestEventLogsExport(req, res) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json({ success: false, error: 'Sessão expirada.' });
  }

  let normalizedFilters;
  try {
    normalizedFilters = buildEventLogFilters(req.body || {});
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Parâmetros inválidos.' });
  }

  const format = String(req.body?.format || 'csv').toLowerCase();

  try {
    const job = await ReportExportModel.create({
      exportType: 'event_logs',
      format,
      filters: normalizedFilters,
      createdBy: sessionUser.id,
    });

    return res.status(202).json({ success: true, data: job });
  } catch (err) {
    console.error('[exports] falha ao criar exportação de auditoria', err);
    return res.status(500).json({ success: false, error: 'Não foi possível agendar a exportação.' });
  }
}

async function requestMessagesExport(req, res) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json({ success: false, error: 'Sessão expirada.' });
  }

  let viewer = null;
  try {
    viewer = await resolveViewerWithSectors(req);
  } catch (err) {
    console.warn('[exports] falha ao resolver viewer', err);
  }

  let normalizedFilters;
  try {
    normalizedFilters = normalizeMessageFilters(req.body || {});
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || 'Parâmetros inválidos.' });
  }

  if (viewer) {
    normalizedFilters._viewer = {
      id: viewer.id,
      viewScope: viewer.viewScope || viewer.view_scope || 'all',
      sectorIds: Array.isArray(viewer.sectorIds) ? viewer.sectorIds : [],
    };
  }

  const format = String(req.body?.format || 'csv').toLowerCase();

  try {
    const job = await ReportExportModel.create({
      exportType: 'messages',
      format,
      filters: normalizedFilters,
      createdBy: sessionUser.id,
    });

    return res.status(202).json({ success: true, data: job });
  } catch (err) {
    console.error('[exports] falha ao criar exportação de registros', err);
    return res.status(500).json({ success: false, error: 'Não foi possível agendar a exportação.' });
  }
}

async function list(req, res) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json({ success: false, error: 'Sessão expirada.' });
  }

  const limit = Math.max(1, Math.min(Number(req.query?.limit) || EXPORT_HISTORY_LIMIT, 100));
  try {
    const items = await ReportExportModel.listByUser(sessionUser.id, { limit });
    const data = items.map((item) => ({
      ...item,
      downloadUrl: item.status === 'completed' ? `/api/report-exports/${item.id}/download` : null,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[exports] falha ao listar histórico', err);
    return res.status(500).json({ success: false, error: 'Falha ao consultar histórico de exportações.' });
  }
}

async function download(req, res) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json({ success: false, error: 'Sessão expirada.' });
  }

  const jobId = String(req.params.id || '').trim();
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'Exportação inválida.' });
  }

  try {
    const job = await ReportExportModel.findById(jobId);
    if (!job || job.created_by !== sessionUser.id) {
      return res.status(404).json({ success: false, error: 'Exportação não encontrada.' });
    }

    if (job.status !== 'completed' || !job.file_path) {
      return res.status(400).json({ success: false, error: 'Arquivo ainda não está disponível.' });
    }

    const absolutePath = path.resolve(process.cwd(), job.file_path);
    if (!absolutePath.startsWith(EXPORT_DIR)) {
      return res.status(403).json({ success: false, error: 'Acesso negado ao arquivo solicitado.' });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(410).json({ success: false, error: 'Arquivo expirado ou removido.' });
    }

    return res.download(absolutePath, job.file_name || path.basename(absolutePath));
  } catch (err) {
    console.error('[exports] falha ao entregar arquivo', err);
    return res.status(500).json({ success: false, error: 'Erro ao preparar download.' });
  }
}

module.exports = {
  requestEventLogsExport,
  requestMessagesExport,
  list,
  download,
};
