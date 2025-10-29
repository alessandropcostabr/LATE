// controllers/intakeController.js
// Endpoint de intake protegido por token.

const Message = require('../models/message');
const IntakeLog = require('../models/intakeLog');
const UserModel = require('../models/user');
const SectorModel = require('../models/sector');
const { __internals } = require('./messageController');

const {
  sanitizePayload,
  extractRecipientInput,
  resolveRecipientTarget,
  notifyRecipientUser,
  notifyRecipientSectorMembers,
  logMessageEvent,
  dispatchBackground,
} = __internals;

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentTime() {
  return new Date().toISOString().slice(11, 16);
}

function extractToken(req) {
  const headerToken = req.get('x-intake-token');
  if (headerToken) return headerToken.trim();
  const auth = req.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  if (typeof req.body?.token === 'string') {
    return req.body.token.trim();
  }
  return '';
}

async function resolveRecipientName({ recipient_user_id, recipient_sector_id, fallback }) {
  if (recipient_user_id) {
    const user = await UserModel.findById(recipient_user_id);
    if (user?.name) return user.name;
    return fallback || `Usuário #${recipient_user_id}`;
  }
  if (recipient_sector_id) {
    const sector = await SectorModel.getById(recipient_sector_id);
    if (sector?.name) return sector.name;
    return fallback || `Setor #${recipient_sector_id}`;
  }
  return fallback || 'Central de Relacionamento';
}

exports.create = async (req, res) => {
  const expectedToken = (process.env.INTAKE_TOKEN || '').trim();
  const providedToken = extractToken(req);
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
  const userAgent = req.get('user-agent') || null;

  if (!expectedToken || providedToken !== expectedToken) {
    await IntakeLog.create({
      status: 'unauthorized',
      token: providedToken || null,
      payload: null,
      ip,
      userAgent,
      error: 'Token inválido',
    });
    return res.status(401).json({ success: false, error: 'Token inválido' });
  }

  const payloadForLog = { ...req.body };
  delete payloadForLog.token;

  try {
    if (!req.body.call_date) req.body.call_date = currentDate();
    if (!req.body.call_time) req.body.call_time = currentTime();

    const recipientInput = extractRecipientInput(req.body);
    const resolved = await resolveRecipientTarget(recipientInput);
    if (resolved.error) {
      await IntakeLog.create({
        status: 'error',
        token: providedToken,
        payload: payloadForLog,
        ip,
        userAgent,
        error: resolved.error,
      });
      return res.status(400).json({ success: false, error: resolved.error });
    }

    const payload = sanitizePayload(req.body);
    payload.recipient = resolved.recipient;
    payload.recipient_user_id = resolved.recipient_user_id ?? null;
    payload.recipient_sector_id = resolved.recipient_sector_id ?? null;
    payload.status = 'pending';
    payload.visibility = payload.visibility || 'private';

    const messageId = await Message.create(payload);
    const created = await Message.findById(messageId);
    if (created) {
      created.recipient = created.recipient || await resolveRecipientName({
        recipient_user_id: created.recipient_user_id,
        recipient_sector_id: created.recipient_sector_id,
        fallback: payload.recipient,
      });

      dispatchBackground('notifyRecipientUser:new', () => notifyRecipientUser(created, { template: 'new' }));
      dispatchBackground('notifyRecipientSectorMembers:new', () => notifyRecipientSectorMembers(created));
    }

    await logMessageEvent(messageId, 'created', {
      user_id: null,
      user_name: 'Intake API',
    });

    await IntakeLog.create({
      messageId,
      status: 'success',
      token: providedToken,
      payload: payloadForLog,
      ip,
      userAgent,
      error: null,
    });

    return res.status(201).json({
      success: true,
      data: { id: messageId },
    });
  } catch (err) {
    await IntakeLog.create({
      status: 'error',
      token: providedToken,
      payload: payloadForLog,
      ip,
      userAgent,
      error: err?.message || String(err),
    });
    console.error('[intake] erro ao registrar contato via intake:', err);
    return res.status(500).json({ success: false, error: 'Falha ao registrar contato' });
  }
};
