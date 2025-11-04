// controllers/eventLogsController.js
// API de auditoria leve para consultar event_logs.

const EventLogModel = require('../models/eventLog');

const MAX_LIMIT = 500;

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseCursor(raw) {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(String(raw), 'base64').toString('utf8');
    const [createdAtIso, id] = decoded.split('|');
    const parsedDate = new Date(createdAtIso);
    if (Number.isNaN(parsedDate.getTime()) || !id) {
      return null;
    }
    return { createdAt: parsedDate, id };
  } catch (_err) {
    return null;
  }
}

function buildDateRange(fromRaw, toRaw) {
  const now = new Date();
  let from = parseDate(fromRaw);
  let to = parseDate(toRaw) || now;

  if (!from) {
    from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (from > to) {
    return { error: 'Parâmetros inválidos.' };
  }

  return { from, to };
}

function normalizeEventTypes(query) {
  if (query.event_type === undefined) return [];
  if (Array.isArray(query.event_type)) return query.event_type;
  return String(query.event_type || '').split(',').map((value) => value.trim()).filter(Boolean);
}

async function list(req, res) {
  try {
    const { from, to, error } = buildDateRange(req.query.from, req.query.to);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const limitRaw = Number(req.query.limit) || 50;
    if (!Number.isFinite(limitRaw) || limitRaw <= 0 || limitRaw > MAX_LIMIT) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos.' });
    }

    const eventTypes = normalizeEventTypes(req.query);
    const cursor = parseCursor(req.query.cursor);
    if (req.query.cursor && !cursor) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos.' });
    }

    const actorUserId = req.query.actor_user_id ? Number(req.query.actor_user_id) : null;
    if (req.query.actor_user_id && (!Number.isInteger(actorUserId) || actorUserId <= 0)) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos.' });
    }

    const result = await EventLogModel.listFiltered({
      from,
      to,
      eventTypes,
      entityType: req.query.entity_type ? String(req.query.entity_type).trim() : null,
      entityId: req.query.entity_id ? String(req.query.entity_id).trim() : null,
      actorUserId,
      search: req.query.search ? String(req.query.search).trim() : null,
      cursor,
      limit: limitRaw,
    });

    return res.json({
      success: true,
      data: {
        items: result.items.map((item) => ({
          id: item.id,
          event_type: item.event_type,
          entity_type: item.entity_type,
          entity_id: item.entity_id,
          actor_user: item.actor_user,
          metadata: item.metadata,
          created_at: item.created_at instanceof Date ? item.created_at.toISOString() : item.created_at,
        })),
        nextCursor: result.nextCursor,
      },
    });
  } catch (err) {
    console.error('[event-logs] erro ao listar eventos:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao consultar os registros de auditoria.' });
  }
}

async function summary(req, res) {
  try {
    const { from, to, error } = buildDateRange(req.query.from, req.query.to);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const eventTypes = normalizeEventTypes(req.query);

    const result = await EventLogModel.summary({
      from,
      to,
      eventTypes,
    });

    return res.json({
      success: true,
      data: {
        byType: result.byType,
        daily: result.daily.map((row) => ({
          date: row.date instanceof Date ? row.date.toISOString() : row.date,
          count: row.count,
        })),
      },
    });
  } catch (err) {
    console.error('[event-logs] erro ao gerar resumo:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao consultar os registros de auditoria.' });
  }
}

async function getById(req, res) {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      return res.status(400).json({ success: false, error: 'Parâmetros inválidos.' });
    }

    const event = await EventLogModel.getById(id);
    if (!event) {
      return res.status(404).json({ success: false, error: 'Registro não encontrado.' });
    }

    return res.json({
      success: true,
      data: {
        id: event.id,
        event_type: event.event_type,
        entity_type: event.entity_type,
        entity_id: event.entity_id,
        actor_user: event.actor_user,
        metadata: event.metadata,
        created_at: event.created_at instanceof Date ? event.created_at.toISOString() : event.created_at,
      },
    });
  } catch (err) {
    console.error('[event-logs] erro ao obter evento:', err);
    return res.status(500).json({ success: false, error: 'Erro interno ao consultar os registros de auditoria.' });
  }
}

module.exports = {
  list,
  summary,
  getById,
};
