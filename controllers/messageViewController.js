// controllers/messageViewController.js
// Views Kanban e Calendário dos registros, respeitando RBAC e filtros server-side.

const Message = require('../models/message');
const UserModel = require('../models/user');
const SectorModel = require('../models/sector');
const MessageLabelModel = require('../models/messageLabel');
const MessageChecklistModel = require('../models/messageChecklist');
const { resolveViewerWithSectors } = require('./helpers/viewer');

const STATUS_LABELS_PT = Message.STATUS_LABELS_PT || {};

const KANBAN_PAGE_SIZE = 20;
const CALENDAR_PAGE_SIZE = 40;

function sanitizeDateInput(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function sanitizeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function sanitizeLabel(value) {
  const text = sanitizeText(value);
  return text ? text.toLowerCase() : null;
}

function parsePage(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return 1;
}

function parseSectorId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function buildPagination(page, limit, hasMore) {
  return {
    page,
    limit,
    hasPrevious: page > 1,
    hasNext: Boolean(hasMore),
    previousPage: page > 1 ? page - 1 : null,
    nextPage: hasMore ? page + 1 : null,
  };
}

function resolveStatusLabel(status) {
  return STATUS_LABELS_PT[status] || status;
}

function formatCallbackLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (_err) {
    return null;
  }
}

function resolveDateInfo(row) {
  if (row.callback_at) {
    const date = new Date(row.callback_at);
    if (!Number.isNaN(date.getTime())) {
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        label: formatDateLabel(key),
        sortValue: date.getTime(),
      };
    }
  }

  const rawDate = String(row.call_date || '').trim();
  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const timestamp = Date.parse(`${rawDate}T00:00:00Z`);
    return {
      key: rawDate,
      label: formatDateLabel(rawDate),
      sortValue: Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp,
    };
  }

  const createdAt = row.created_at ? new Date(row.created_at) : null;
  if (createdAt && !Number.isNaN(createdAt.getTime())) {
    const key = createdAt.toISOString().slice(0, 10);
    return {
      key,
      label: formatDateLabel(key),
      sortValue: createdAt.getTime(),
    };
  }

  return {
    key: 'sem-data',
    label: 'Sem data',
    sortValue: Number.MAX_SAFE_INTEGER,
  };
}

function formatDateLabel(dateKey) {
  if (!dateKey || dateKey === 'sem-data') {
    return 'Sem data';
  }
  const parts = dateKey.split('-');
  if (parts.length !== 3) {
    return dateKey;
  }
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

function extractFilters(query = {}) {
  const startDate = sanitizeDateInput(query.start_date || query.data_inicio);
  const endDate = sanitizeDateInput(query.end_date || query.data_fim);
  const recipient = sanitizeText(query.recipient || query.destinatario);
  const sectorId = parseSectorId(query.sector_id ?? query.recipient_sector_id ?? query.sector);
  const label = sanitizeLabel(query.label);

  return {
    startDate,
    endDate,
    recipient,
    sectorId,
    label,
  };
}

function mapKanbanCard(row, labelsMap, progressMap) {
  const labels = labelsMap.get(row.id) || [];
  const progress = progressMap.get(row.id);
  const callbackLabel = formatCallbackLabel(row.callback_at);
  return {
    id: row.id,
    subject: row.subject,
    recipient: row.recipient,
    status: row.status,
    statusLabel: resolveStatusLabel(row.status),
    callDate: row.call_date,
    callTime: row.call_time,
    callbackAt: row.callback_at,
    callbackTime: callbackLabel,
    updatedAt: row.updated_at,
    labels,
    checklistProgress: Number.isInteger(progress) ? progress : null,
  };
}

function mapCalendarEntry(row, labelsMap) {
  const labels = labelsMap.get(row.id) || [];
  const dateInfo = resolveDateInfo(row);
  const callbackLabel = formatCallbackLabel(row.callback_at);
  const callbackSortValue = (() => {
    if (!row.callback_at) return Number.MAX_SAFE_INTEGER;
    const date = new Date(row.callback_at);
    return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
  })();
  return {
    id: row.id,
    subject: row.subject,
    recipient: row.recipient,
    callTime: row.call_time,
    callbackAt: row.callback_at,
    callbackTime: callbackLabel,
    callbackSortValue,
    status: row.status,
    statusLabel: resolveStatusLabel(row.status),
    labels,
    dateInfo,
  };
}

async function fetchFilterOptions(viewer) {
  const [users, sectorsResult, labels] = await Promise.all([
    UserModel.getActiveUsersSelect(),
    SectorModel.list({ status: 'active', limit: 200 }),
    MessageLabelModel.listDistinct({ limit: 200, viewer }),
  ]);

  return {
    destinatariosUsuarios: users || [],
    destinatariosSetores: sectorsResult?.data || [],
    labels,
  };
}

function buildCommonViewData(req, filters, pagination, widgets, extra = {}) {
  const csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : undefined;

  return {
    ...extra,
    csrfToken,
    filters,
    pagination,
    widgets,
    user: req.session?.user || null,
  };
}

exports.kanbanPage = async (req, res) => {
  try {
    const viewer = await resolveViewerWithSectors(req);
    const filters = extractFilters(req.query);
    const page = parsePage(req.query.page);
    const offset = (page - 1) * KANBAN_PAGE_SIZE;

    const baseOptions = {
      start_date: filters.startDate,
      end_date: filters.endDate,
      recipient: filters.recipient,
      sector_id: filters.sectorId,
      label: filters.label,
      viewer,
      order_by: 'callback_at',
      order: 'desc',
      offset,
      limit: KANBAN_PAGE_SIZE + 1,
    };

    const statuses = ['pending', 'in_progress', 'resolved'];
    const columnResults = await Promise.all(statuses.map(async (status) => {
      const rows = await Message.list({ ...baseOptions, status });
      const hasMore = rows.length > KANBAN_PAGE_SIZE;
      const trimmed = hasMore ? rows.slice(0, KANBAN_PAGE_SIZE) : rows;
      return {
        status,
        statusLabel: resolveStatusLabel(status),
        rows: trimmed,
        hasMore,
      };
    }));

    const messageIds = columnResults
      .flatMap((column) => column.rows.map((row) => row.id));

    const [labelsMap, progressMap, filterOptions, widgets] = await Promise.all([
      MessageLabelModel.listByMessages(messageIds),
      MessageChecklistModel.progressByMessages(messageIds),
      fetchFilterOptions(viewer),
      Message.widgetCounters({
        start_date: filters.startDate,
        end_date: filters.endDate,
        recipient: filters.recipient,
        sector_id: filters.sectorId,
        label: filters.label,
        viewer,
      }),
    ]);

    const board = columnResults.map((column) => ({
      status: column.status,
      statusLabel: column.statusLabel,
      hasMore: column.hasMore,
      cards: column.rows.map((row) => mapKanbanCard(row, labelsMap, progressMap)),
    }));

    const pagination = buildPagination(page, KANBAN_PAGE_SIZE, board.some((column) => column.hasMore));

    const viewData = buildCommonViewData(
      req,
      filters,
      pagination,
      widgets,
      {
        title: 'Registros · Kanban',
        board,
        pageSize: KANBAN_PAGE_SIZE,
        destinatariosUsuarios: filterOptions.destinatariosUsuarios,
        destinatariosSetores: filterOptions.destinatariosSetores,
        labelsDisponiveis: filterOptions.labels,
      }
    );

    return res.render('recados-kanban', viewData);
  } catch (err) {
    console.error('[recados/kanban] erro ao renderizar:', err);
    return res.status(500).render('500', { title: 'Erro interno', user: req.session?.user || null });
  }
};

exports.calendarPage = async (req, res) => {
  try {
    const viewer = await resolveViewerWithSectors(req);
    const filters = extractFilters(req.query);
    const page = parsePage(req.query.page);
    const offset = (page - 1) * CALENDAR_PAGE_SIZE;

    const options = {
      start_date: filters.startDate,
      end_date: filters.endDate,
      recipient: filters.recipient,
      sector_id: filters.sectorId,
      label: filters.label,
      viewer,
      order_by: 'callback_at',
      order: 'asc',
      use_callback_date: true,
      offset,
      limit: CALENDAR_PAGE_SIZE + 1,
    };

    const rows = await Message.list(options);
    const hasMore = rows.length > CALENDAR_PAGE_SIZE;
    const trimmed = hasMore ? rows.slice(0, CALENDAR_PAGE_SIZE) : rows;

    const messageIds = trimmed.map((row) => row.id);

    const [labelsMap, filterOptions, widgets] = await Promise.all([
      MessageLabelModel.listByMessages(messageIds),
      fetchFilterOptions(viewer),
      Message.widgetCounters({
        start_date: filters.startDate,
        end_date: filters.endDate,
        recipient: filters.recipient,
        sector_id: filters.sectorId,
        label: filters.label,
        viewer,
      }),
    ]);

    const grouped = trimmed.reduce((acc, row) => {
      const entry = mapCalendarEntry(row, labelsMap);
      const existing = acc.get(entry.dateInfo.key);
      if (!existing) {
        acc.set(entry.dateInfo.key, {
          sortValue: entry.dateInfo.sortValue,
          label: entry.dateInfo.label,
          items: [entry],
        });
      } else {
        existing.items.push(entry);
      }
      return acc;
    }, new Map());

    const calendar = Array.from(grouped.entries())
      .map(([key, info]) => ({
        key,
        label: info.label,
        sortValue: info.sortValue,
        items: info.items
          .sort((a, b) => a.callbackSortValue - b.callbackSortValue)
          .map(({ callbackSortValue, ...rest }) => rest),
      }))
      .sort((a, b) => a.sortValue - b.sortValue || a.key.localeCompare(b.key));

    const pagination = buildPagination(page, CALENDAR_PAGE_SIZE, hasMore);

    const viewData = buildCommonViewData(
      req,
      filters,
      pagination,
      widgets,
      {
        title: 'Registros · Calendário',
        calendar,
        pageSize: CALENDAR_PAGE_SIZE,
        destinatariosUsuarios: filterOptions.destinatariosUsuarios,
        destinatariosSetores: filterOptions.destinatariosSetores,
        labelsDisponiveis: filterOptions.labels,
      }
    );

    return res.render('recados-calendario', viewData);
  } catch (err) {
    console.error('[recados/calendario] erro ao renderizar:', err);
    return res.status(500).render('500', { title: 'Erro interno', user: req.session?.user || null });
  }
};
