// middleware/cors.js
// Comentários em pt-BR; identificadores em inglês.
// Regras:
// - Aplica CORS para a API (usa mesmas regras em qualquer caminho, o server.js decide onde montar).
// - Allowlist via CORS_ORIGINS (CSV). Permite same-origin e requisições sem Origin.
// - Exporta ALLOWED_METHODS/ALLOWED_HEADERS para uso no preflight do server.js.
// - Mensagens em pt-BR; chaves JSON em inglês.

function parseOrigins(env) {
  return String(env || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.toLowerCase());
}

const configured = parseOrigins(process.env.CORS_ORIGINS);

// Constantes expostas (server.js usa no preflight OPTIONS)
const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, X-Requested-With, X-CSRF-Token';

function apiCors(req, res, next) {
  const originHdr = req.headers.origin || '';
  const origin = originHdr.toLowerCase();

  // Monta o "host origin" atual (ex.: http://localhost:3000)
  const scheme = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const hostOrigin = `${scheme}://${host}`.toLowerCase();

  const noOrigin = !origin;                  // same-origin "cru" (navegação normal) vem sem Origin
  const isSameOrigin = origin && origin === hostOrigin;
  const isConfigured = origin && configured.includes(origin);

  // Permitimos: ausência de Origin (same-origin), same-origin explícito, ou origin da allowlist
  const allowed = noOrigin || isSameOrigin || isConfigured;

  if (!allowed) {
    return res.status(403).json({ success: false, error: 'Origem não permitida' });
  }

  // Só anexa cabeçalhos CORS quando existir uma origem cross-origin permitida
  if (origin && origin !== hostOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  }

  // Trata pré-flight
  if (req.method === 'OPTIONS') return res.sendStatus(204);

  return next();
}

// Exporta constantes para o server.js (preflight global)
apiCors.ALLOWED_METHODS = ALLOWED_METHODS;
apiCors.ALLOWED_HEADERS = ALLOWED_HEADERS;

module.exports = apiCors;

