// middleware/healthGate.js
// Fallback rápido: testa PG; se falhar, responde 503. APIs retornam JSON; web renderiza EJS.

const db = require('../config/database');

const DB_TIMEOUT_MS = 300; // timeout curto para evitar travar requests
const CIRCUIT_BREAKER = {
  failures: 0,
  threshold: 3,
  resetAfterMs: 30_000,
  openedAt: null,
};

const BYPASS_PREFIXES = [
  '/api/health',
  '/api/report-incident',
  '/api/csp-report',
  '/health',
  '/assets',
  '/css',
  '/js',
  '/img',
  '/favicon.ico',
  '/robots.txt',
];

function shouldBypass(req) {
  const path = req.path || req.originalUrl || '';
  return BYPASS_PREFIXES.some((prefix) => path.startsWith(prefix));
}

let lastOkAt = 0; // cachezinho KISS para evitar ping a cada request

async function pingDatabase() {
  const now = Date.now();
  if (now - lastOkAt < 800) return; // TTL curto (~0.8s) KISS

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL statement_timeout TO ${DB_TIMEOUT_MS}`);
    await client.query('SELECT 1');
    await client.query('COMMIT');
    lastOkAt = Date.now();
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* noop */ }
    throw err;
  } finally {
    client.release();
  }
}

function circuitIsOpen() {
  if (CIRCUIT_BREAKER.failures < CIRCUIT_BREAKER.threshold) return false;
  const now = Date.now();
  if (CIRCUIT_BREAKER.openedAt && now - CIRCUIT_BREAKER.openedAt < CIRCUIT_BREAKER.resetAfterMs) {
    return true;
  }
  CIRCUIT_BREAKER.failures = 0;
  CIRCUIT_BREAKER.openedAt = null;
  return false;
}

function registerFailure() {
  CIRCUIT_BREAKER.failures += 1;
  CIRCUIT_BREAKER.openedAt = CIRCUIT_BREAKER.openedAt || Date.now();
}

function resetCircuit() {
  CIRCUIT_BREAKER.failures = 0;
  CIRCUIT_BREAKER.openedAt = null;
}

function isApiRequest(req) {
  const path = req.originalUrl || req.path || '';
  return path.startsWith('/api/');
}

function api503(res) {
  return res.status(503).json({
    success: false,
    error: 'Serviço temporariamente indisponível',
    code: 'DB_UNAVAILABLE',
  });
}

async function healthGate(req, res, next) {
  if (shouldBypass(req)) return next();

  if (circuitIsOpen()) {
    return isApiRequest(req)
      ? api503(res)
      : res.status(503).render('error-operacional', {
          title: 'Sistema temporariamente indisponível',
          errorCode: 'HEALTH_GATE_OPEN',
        });
  }

  try {
    await pingDatabase();
    resetCircuit();
    return next();
  } catch (err) {
    console.error('[healthGate] Falha no ping de banco:', err?.message || err);
    registerFailure();
    return isApiRequest(req)
      ? api503(res)
      : res.status(503).render('error-operacional', {
          title: 'Sistema temporariamente indisponível',
          errorCode: 'DB_UNAVAILABLE',
        });
  }
}

module.exports = healthGate;
