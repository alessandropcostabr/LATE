// infra/diagnostics/diagnostic-api.js
// API mínima para acionar o script diagnose.sh no Darkstar

const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PORT = Number(process.env.DIAGNOSTIC_API_PORT || 8888);
const TOKEN = process.env.DARKSTAR_DIAGNOSTIC_TOKEN || '';
const SCRIPT_PATH = process.env.DIAGNOSTIC_SCRIPT || '/opt/late-diagnostics/diagnose.sh';
const ALLOWLIST = (process.env.DIAGNOSTIC_ALLOWLIST || '192.168.0.251,192.168.0.252,192.168.0.253')
  .split(',')
  .map((ip) => ip.trim())
  .filter(Boolean);

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  const hdr = req.headers['x-forwarded-for'];
  if (hdr) return hdr.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function unauthorized(res, message = 'Unauthorized') {
  json(res, 401, { error: message });
}

function badRequest(res, message = 'Bad Request') {
  json(res, 400, { error: message });
}

function ok(res, body) {
  json(res, 200, body);
}

function runDiagnostic(incidentId) {
  const child = spawn('bash', [SCRIPT_PATH, incidentId], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function handler(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    return ok(res, { status: 'ok', timestamp: new Date().toISOString() });
  }

  if (req.method !== 'POST' || req.url !== '/trigger-diagnostic') {
    res.writeHead(404); res.end(); return;
  }

  const ip = clientIp(req);
  if (ALLOWLIST.length && !ALLOWLIST.includes(ip)) {
    return unauthorized(res, 'IP not allowed');
  }

  if (!TOKEN || req.headers['x-diagnostic-token'] !== TOKEN) {
    return unauthorized(res);
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
    if (body.length > 5 * 1024) {
      badRequest(res, 'Payload too large');
      req.destroy();
    }
  });

  req.on('end', () => {
    let parsed = {};
    if (body) {
      try { parsed = JSON.parse(body); } catch { return badRequest(res); }
    }
    const incidentId = parsed.incident_id || crypto.randomUUID();
    runDiagnostic(String(incidentId));
    ok(res, { success: true, incident_id: incidentId });
  });
}

http.createServer(handler).listen(PORT, '0.0.0.0', () => {
  console.log(`[diagnostic-api] escutando em ${PORT}, allowlist=${ALLOWLIST.join(',')}`);
});
