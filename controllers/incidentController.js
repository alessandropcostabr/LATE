// controllers/incidentController.js
// Endpoint de reporte de incidentes com rate limit (Redis + fallback memória)
// e gatilho opcional no Darkstar.

const { randomUUID } = require('crypto');
const EventLogModel = require('../models/eventLog');
const { getRedis } = require('../utils/redisClient');

const RATE_WINDOW_MS = Number(process.env.REPORT_INCIDENT_WINDOW_MS || 60 * 60 * 1000); // padrão: 1h
const RATE_MAX_PER_IP = Number(process.env.REPORT_INCIDENT_MAX_PER_IP || 3);
const RATE_MAX_PER_SESSION = Number(process.env.REPORT_INCIDENT_MAX_PER_SESSION || 5);
const DIAG_TIMEOUT_MS = Number(process.env.DIAGNOSTIC_TIMEOUT_MS || process.env.DARKSTAR_DIAGNOSTIC_TIMEOUT_MS || 5000);

// Fallback em memória, usado se Redis indisponível
const ipHits = new Map();
const sessionHits = new Map();

function cleanupHits(map, now) {
  for (const [key, timestamps] of map.entries()) {
    const fresh = timestamps.filter((ts) => now - ts < RATE_WINDOW_MS);
    if (fresh.length) {
      map.set(key, fresh);
    } else {
      map.delete(key);
    }
  }
}

function registerHit(map, key, limit, now) {
  const list = map.get(key) || [];
  const fresh = list.filter((ts) => now - ts < RATE_WINDOW_MS);
  fresh.push(now);
  map.set(key, fresh);
  return fresh.length > limit;
}

async function incrWithTtl(redis, key, ttlSeconds) {
  // INCR + EXPIRE NX para garantir janela fixa
  const [[, incrValue]] = await redis
    .pipeline()
    .incr(key)
    .expire(key, ttlSeconds, 'NX')
    .exec();
  return Number(incrValue) || 0;
}

async function checkRateLimitRedis(redis, { ip, sessionId }) {
  const ttlSeconds = Math.ceil(RATE_WINDOW_MS / 1000);
  const ipKey = ip ? `incident:rl:ip:${ip}` : null;
  const sessKey = sessionId ? `incident:rl:sess:${sessionId}` : null;

  const [ipCount, sessCount] = await Promise.all([
    ipKey ? incrWithTtl(redis, ipKey, ttlSeconds) : Promise.resolve(0),
    sessKey ? incrWithTtl(redis, sessKey, ttlSeconds) : Promise.resolve(0),
  ]);

  const blocked = (ipCount > RATE_MAX_PER_IP) || (sessCount > RATE_MAX_PER_SESSION);
  return { blocked, ipCount, sessCount };
}

async function triggerDiagnostic(incidentId, payload) {
  const url = process.env.DIAGNOSTIC_URL || process.env.DARKSTAR_DIAGNOSTIC_URL;
  const token = process.env.DIAGNOSTIC_TOKEN || process.env.DARKSTAR_DIAGNOSTIC_TOKEN;
  if (!url || !token) {
    return { triggered: false, reason: 'missing_env' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIAG_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Diagnostic-Token': token,
      },
      body: JSON.stringify({ incident_id: incidentId, ...payload }),
      signal: controller.signal,
    });

    return { triggered: res.ok, status: res.status };
  } catch (err) {
    console.error('[incident] falha ao acionar diagnóstico no Darkstar:', err?.message || err);
    return { triggered: false, error: err?.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

exports.report = async (req, res) => {
  const now = Date.now();
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  const sessionId = req.sessionID || req.session?.id || null;

  // Rate limit (Redis preferencial, fallback Map)
  try {
    const redis = getRedis();
    if (redis) {
      const { blocked } = await checkRateLimitRedis(redis, { ip: clientIp, sessionId });
      if (blocked) {
        return res.status(429).json({
          success: false,
          message: 'Limite de relatos atingido. Tente novamente em breve.',
        });
      }
    } else {
      cleanupHits(ipHits, now);
      cleanupHits(sessionHits, now);
      const hitIp = registerHit(ipHits, clientIp, RATE_MAX_PER_IP, now);
      const hitSess = sessionId ? registerHit(sessionHits, sessionId, RATE_MAX_PER_SESSION, now) : false;
      if (hitIp || hitSess) {
        return res.status(429).json({
          success: false,
          message: 'Limite de relatos atingido. Tente novamente em breve.',
        });
      }
    }
  } catch (err) {
    console.error('[incident] falha no rate limit (fallback para Map):', err?.message || err);
    cleanupHits(ipHits, now);
    cleanupHits(sessionHits, now);
    const hitIp = registerHit(ipHits, clientIp, RATE_MAX_PER_IP, now);
    const hitSess = sessionId ? registerHit(sessionHits, sessionId, RATE_MAX_PER_SESSION, now) : false;
    if (hitIp || hitSess) {
      return res.status(429).json({ success: false, message: 'Limite de relatos atingido. Tente novamente em breve.' });
    }
  }

  const incidentId = randomUUID();
  const { description, url, errorCode, userAgent } = req.body || {};

  const metadata = {
    source: 'user_report',
    error_code: typeof errorCode === 'string' ? errorCode : null,
    url: typeof url === 'string' ? url : null,
    description: typeof description === 'string' ? description.slice(0, 500) : null,
    client_ip: clientIp,
    session_id: sessionId,
    user_agent: typeof userAgent === 'string' ? userAgent.slice(0, 500) : req.headers['user-agent'],
    referrer: req.headers?.referer || req.headers?.referrer || null,
  };

  let eventLogId = null;
  try {
    const event = await EventLogModel.create({
      eventType: 'incident_report',
      entityType: 'incident',
      entityId: incidentId,
      actorUserId: req.session?.user?.id || null,
      metadata,
    });
    eventLogId = event?.id || null;
  } catch (err) {
    console.error('[incident] falha ao registrar event_logs:', err?.message || err);
  }

  const diagResult = await triggerDiagnostic(incidentId, {
    source: 'late-app',
    node: process.env.NODE_NAME || 'late-dev',
  });

  return res.json({
    success: true,
    message: 'Obrigado! Registramos seu relato.',
    incident_id: incidentId,
    event_log_id: eventLogId,
    diagnostic_triggered: diagResult.triggered,
  });
};
