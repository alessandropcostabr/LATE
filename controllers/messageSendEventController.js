const MessageSendEvent = require('../models/messageSendEvent');

function buildFilters(query = {}) {
  return {
    source: query.source || 'sender-whatsapp',
    status: query.status || undefined,
    phone: query.phone || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
  };
}

async function createApi(req, res) {
  try {
    const body = req.body || {};
    const source = body.source || 'sender-whatsapp';
    const idempotencyKey = req.get('Idempotency-Key') || body.idempotency_key;

    if (!idempotencyKey) {
      return res.status(400).json({ success: false, error: 'Cabeçalho Idempotency-Key é obrigatório' });
    }

    const eventPayload = {
      ...body,
      source,
      idempotency_key: idempotencyKey,
      payload_raw: body,
    };

    const { row, inserted } = await MessageSendEvent.insertIdempotent(eventPayload);

    if (!row) {
      return res.status(500).json({ success: false, error: 'Erro ao registrar evento' });
    }

    return res.status(200).json({
      success: true,
      idempotent: !inserted,
      event_id: row.id,
      message: inserted ? 'Evento registrado com sucesso' : 'Evento já estava registrado',
    });
  } catch (err) {
    console.error('[messageSendEventController] createApi error', err);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

async function listApi(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const filters = buildFilters(req.query);

    const rows = await MessageSendEvent.list(filters, { limit, offset });
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[messageSendEventController] listApi error', err);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

async function renderList(req, res) {
  try {
    const filters = buildFilters(req.query);
    const events = await MessageSendEvent.list(filters, { limit: 100, offset: 0 });
    return res.render('relatorios-whatsapp', {
      title: 'Relatórios · WhatsApp Sender',
      user: req.session.user || null,
      events: events || [],
      filters,
    });
  } catch (err) {
    console.error('[messageSendEventController] renderList error', err);
    return res.status(500).render('500', { title: 'Erro', user: req.session.user || null });
  }
}

module.exports = {
  createApi,
  listApi,
  renderList,
};
