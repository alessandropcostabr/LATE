// controllers/telephonyController.js
// Ingestão de eventos AMI (Asterisk) → LATE

const crypto = require('crypto');
const ipaddr = require('ipaddr.js');
const TelephonyEventModel = require('../models/telephonyEventModel');

function parseAllowlist(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function ipAllowed(ip, allowlist) {
  if (!allowlist || allowlist.length === 0) return true;
  try {
    const parsedIp = ipaddr.parse(ip);
    return allowlist.some((entry) => {
      try {
        if (entry.includes('/')) {
          const [cidrIp, prefix] = entry.split('/');
          const cidr = ipaddr.parse(cidrIp);
          return parsedIp.match(cidr, Number(prefix));
        }
        return parsedIp.toString() === ipaddr.parse(entry).toString();
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function safeTimingEqual(a, b) {
  try {
    if (!a || !b) return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function verifyHmac(rawBody, secret, signatureHeader) {
  if (!secret) return false;
  if (!signatureHeader) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return safeTimingEqual(signatureHeader, computed);
}

function jsonError(res, status, message, code) {
  return res.status(status).json({ success: false, error: message, code });
}

async function ingest(req, res) {
  const bearer = process.env.TELEPHONY_BEARER || '';
  const hmacSecret = process.env.TELEPHONY_HMAC_SECRET || '';
  const allowlist = parseAllowlist(process.env.TELEPHONY_ALLOWLIST || '');

  const auth = req.headers.authorization || '';
  if (!bearer || auth !== `Bearer ${bearer}`) {
    return jsonError(res, 401, 'Não autorizado', 'UNAUTHORIZED');
  }

  const remoteIp = (req.ip || '').replace('::ffff:', '');
  if (!ipAllowed(remoteIp, allowlist)) {
    return jsonError(res, 403, 'Acesso negado para este IP', 'FORBIDDEN_IP');
  }

  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const sig = req.headers['x-signature'];
  if (!verifyHmac(rawBody, hmacSecret, sig)) {
    return jsonError(res, 401, 'Assinatura inválida', 'INVALID_SIGNATURE');
  }

  const {
    uniqueid,
    event,
    state,
    caller = null,
    callee = null,
    trunk = null,
    start_ts,
  } = req.body || {};

  if (!uniqueid || !event || !start_ts) {
    return jsonError(res, 400, 'Campos obrigatórios: uniqueid, event, start_ts', 'INVALID_PAYLOAD');
  }

  try {
    const result = await TelephonyEventModel.insertEvent({
      uniqueid,
      event,
      state: state || null,
      caller,
      callee,
      trunk,
      start_ts,
      payload: req.body,
    });

    return res.json({ success: true, data: { persisted: result.persisted, id: result.id } });
  } catch (err) {
    console.error('[telephony] erro ao salvar evento:', err.message || err);
    return jsonError(res, 500, 'Erro ao salvar evento', 'DB_ERROR');
  }
}

module.exports = { ingest };
