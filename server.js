// server.js — Express 5 + EJS + PostgreSQL + sessions (PG-only)
// Comentários em pt-BR; identificadores em inglês.

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const compression = require('compression');

const envFile = process.env.DOTENV_FILE
  ? path.resolve(process.cwd(), process.env.DOTENV_FILE)
  : path.join(__dirname, '.env');
require('dotenv').config({ path: envFile });

const express = require('express');
const corsMw = require('./middleware/cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const db = require('./config/database'); // Pool do pg (PG-only)
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');
const { startAlertScheduler } = require('./services/messageAlerts');
const { normalizeRoleSlug, hasPermission } = require('./middleware/auth');
const packageInfo = require('./package.json');
const { resolveSessionSecret } = require('./config/sessionSecret');

let validateOrigin;
try { validateOrigin = require('./middleware/validateOrigin'); } catch { validateOrigin = null; }

const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3100);
const HOST = process.env.HOST || '0.0.0.0';
// NÃO achatar para boolean. Preservar number/string conforme Express:
// aceita: number (hops), true/false, 'loopback' | 'linklocal' | 'uniquelocal' | lista/CIDR.
const rawTrustProxy = (process.env.TRUST_PROXY ?? (isProd ? '1' : '')).toString().trim();

const app = express();
app.set(
  'trust proxy',
  /^\d+$/.test(rawTrustProxy)
    ? Number(rawTrustProxy)            // "1","2",...
    : rawTrustProxy === ''
      ? false                          // vazio → desliga
      : rawTrustProxy === 'true'
        ? true
        : rawTrustProxy === 'false'
          ? false
          : rawTrustProxy              // 'loopback'|'linklocal'|'uniquelocal' ou CIDR/IP
);
app.set('etag', false);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? undefined : false, // Por quê: HSTS apenas em produção/HTTPS
}));

const apiCsp = helmet.contentSecurityPolicy({
  directives: {
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    'style-src': ["'self'"],
    'style-src-attr': ["'none'"],
    'img-src': ["'self'", 'data:'],
    'font-src': ["'self'", 'https:', 'data:'],
    'connect-src': ["'self'"],
    'object-src': ["'none'"],
  },
});

console.log(`[BOOT] trust proxy = ${app.get('trust proxy')}, NODE_ENV=${process.env.NODE_ENV || 'undefined'}`);

// caminho do CSS nas views (não altera layout, apenas escolhe o arquivo já existente)
app.locals.cssFile = isProd ? '/css/style.min.css' : '/css/style.css';
const packageVersion = packageInfo.version || '0.0.0';
app.locals.appVersion = process.env.APP_VERSION || packageVersion;
let resolvedBuild = process.env.APP_BUILD;
if (!resolvedBuild) {
  try {
    resolvedBuild = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (err) {
    resolvedBuild = 'dev';
    console.warn('[BOOT] não foi possível resolver git rev:', err?.message || err);
  }
}
app.locals.appBuild = resolvedBuild;

// EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS + CSP somente na API
app.use('/api', corsMw);
app.use('/api', apiCsp);

if (isProd && validateOrigin) app.use(validateOrigin);

// Rate limits
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.method !== 'POST'
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de requisições atingido. Aguarde antes de tentar novamente.' },
  skip: req => req.method === 'OPTIONS'
});

// Estáticos / logs / parsers
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use(morgan('combined'));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Sessão (connect-pg-simple usando o mesmo Pool)
const secureCookie = isProd ? 'auto' : false;
const sessionPool = db;
const sessionName = isProd ? 'late.sess' : 'late.dev.sess'; // nome distinto por ambiente
const sessionSecret = resolveSessionSecret({ isProd });

app.use(session({
  name: sessionName, // Por quê: evitar colisão de cookie quando prod/dev compartilham domínio
  secret: sessionSecret,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  store: new PgSession({
    pool: sessionPool,
    tableName: process.env.SESSION_TABLE || 'sessions',
    schemaName: process.env.SESSION_SCHEMA || 'public',
    createTableIfMissing: !isProd, // evita exigir CREATE TABLE em produção
    pruneSessionInterval: 60 * 60 // em segundos (1h) // Por quê: coleta periódica de sessões expiradas p/ reduzir bloat
  }),
  cookie: {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4 // 4h
  }
}));

// ⚠️ Importante: sem csurf global aqui. Proteção CSRF fica por rota no routes/web.js.
app.use((req, res, next) => {
  res.locals.appVersion = app.locals.appVersion;
  res.locals.appBuild = app.locals.appBuild;
  next();
});

// user e permissões disponíveis nas views
app.use((req, res, next) => {
  const sessionUser = req.session.user || null;
  const roleSlug = normalizeRoleSlug(sessionUser?.role);

  res.locals.user = sessionUser;
  res.locals.userRoleSlug = roleSlug;
  res.locals.permissions = {
    readMessages: hasPermission(roleSlug, 'read'),
    createMessages: hasPermission(roleSlug, 'create'),
    updateMessages: hasPermission(roleSlug, 'update'),
    deleteMessages: hasPermission(roleSlug, 'delete'),
  };

  next();
});

// Cache-control básico
app.use((req, res, next) => {
  if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
    if (req.url.match(/\.[0-9a-fA-F]{8,}\./)) {
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  } else {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});

// Bundles leves (inalterado)
const jsDir = path.join(__dirname, 'public', 'js');
const shouldBypassCache = !isProd && process.env.BYPASS_BUNDLE_CACHE === 'true';

let appBundle;
let recadosBundle;

const buildAppBundle = () => {
  const appJs = fs.readFileSync(path.join(jsDir, 'app.js'), 'utf8');
  const utilsJs = fs.readFileSync(path.join(jsDir, 'utils.js'), 'utf8');
  const combined = utilsJs + '\n' + appJs;
  return (
    '(function (root, factory) {\n' +
    '  if (typeof module === "object" && module.exports) {\n' +
    '    const mod = factory(root);\n' +
    '    module.exports = mod;\n' +
    '    module.exports.default = mod;\n' +
    '  } else if (typeof define === "function" && define.amd) {\n' +
    '    define([], function () { return factory(root); });\n' +
    '  } else {\n' +
    '    factory(root);\n' +
    '  }\n' +
    '}(typeof self !== "undefined" ? self : this, function (root) {\n' +
    '  if (!root.API || !root.Utils || !root.Form || !root.Loading || !root.Toast) {\n' +
           combined + '\n' +
    '    if (!root.API && typeof API !== "undefined") root.API = API;\n' +
    '    if (!root.Utils && typeof Utils !== "undefined") root.Utils = Utils;\n' +
    '    if (!root.Form && typeof Form !== "undefined") root.Form = Form;\n' +
    '    if (!root.Loading && typeof Loading !== "undefined") root.Loading = Loading;\n' +
    '  }\n' +
    '  root.Toast = root.Toast || (typeof Toast !== "undefined" ? Toast : {});\n' +
    '  return { API: root.API, Utils: root.Utils, Form: root.Form, Loading: root.Loading, Toast: root.Toast };\n' +
    '}));'
  );
};

const buildRecadosBundle = () => {
  const recadosJs = fs.readFileSync(path.join(jsDir, 'recados.js'), 'utf8');
  const helper = "const q = sel => document.querySelector(sel);\n";
  return (
    helper +
    recadosJs
      .replace(/document.getElementById\('listaRecados'\)/g, "q('#listaRecados, #recadosContainer')")
      .replace(/document.getElementById\('totalResultados'\)/g, "q('#totalResultados, #totalRecados')")
  );
};

if (!shouldBypassCache) {
  appBundle = buildAppBundle();
  recadosBundle = buildRecadosBundle();
}

const sendAppBundle = (req, res) => {
  if (shouldBypassCache || !appBundle) appBundle = buildAppBundle();
  res.type('application/javascript').send(appBundle);
};
const sendRecadosBundle = (req, res) => {
  if (shouldBypassCache || !recadosBundle) recadosBundle = buildRecadosBundle();
  res.type('application/javascript').send(recadosBundle);
};

app.get('/js/app.js', sendAppBundle);
app.get('/js/utils.js', sendAppBundle);
app.get('/js/recados.js', sendRecadosBundle);

// Toast util (inalterado)
app.get('/js/toast.js', (_req, res) => {
  res
    .type('application/javascript')
    .send(`(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const mod = factory();
    module.exports = mod;
    module.exports.default = mod;
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.Toast = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  if (typeof window !== 'undefined' && window.Toast) return window.Toast;
  const Toast = {
    container: null,
    _create(message, type) {
      if (!Toast.container) {
        Toast.container = document.createElement('div');
        Toast.container.className = 'toast-container';
        document.body.appendChild(Toast.container);
      }
      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.textContent = message;
      Toast.container.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => {
        el.classList.remove('show');
        el.addEventListener('transitionend', () => el.remove());
      }, 3000);
    },
    success(msg) { Toast._create(msg, 'success'); },
    warning(msg) { Toast._create(msg, 'warning'); },
    error(msg) { Toast._create(msg, 'error'); },
    info(msg) { Toast._create(msg, 'info'); }
  };
  if (typeof window !== 'undefined' && !window.Toast) {
    window.Toast = Toast;
  }
  return Toast;
}));`);
});

// Favicon: servir logo existente ou 204 (sem ruído)
app.get('/favicon.ico', (req, res) => {
  const logoPath = path.join(__dirname, 'public', 'assets', 'logo.png');
  res.set('Cache-Control', 'public, max-age=86400');
  return res.sendFile(logoPath, (err) => {
    if (err) return res.status(204).end();
  });
});

// Estáticos raiz
app.use(express.static(path.join(__dirname, 'public')));

// defaults para views
app.use((req, res, next) => {
  if (!Array.isArray(res.locals.errors)) res.locals.errors = [];
  next();
});

// Health HTTP plano (não consulta o banco) para HAProxy/VIP
app.get('/health', (_req, res) => res.status(200).send('OK'));

// Rotas
app.use('/login', loginLimiter);
app.use('/api', apiLimiter);
app.use('/api', apiRoutes); // ✅ API primeiro (antes das rotas Web)
app.use('/', webRoutes);    // Web por último (tem 404 próprio)

// Erros genéricos
app.use((err, req, res, _next) => {
  console.error('Erro não tratado:', err);
  const status = err.status || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Diferencia resposta entre API (JSON) e Web (HTML)
  // Usa req.originalUrl pois req.path pode estar sem o prefixo /api/ após roteamento
  if (req.originalUrl.startsWith('/api/')) {
    res.status(status).json({
      success: false,
      error: isDevelopment && err.message ? err.message : 'Erro interno'
    });
  } else {
    // Rotas web devem renderizar página de erro
    res.status(status).render('500', {
      title: 'Erro interno',
      user: req.session?.user || null,
      error: isDevelopment ? (err.stack || err.message || String(err)) : null
    });
  }
});

// 404
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: 'Endpoint não encontrado' });
  } else {
    res.status(404).render('404');
  }
});

// Boot
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'dev'}, env=${envFile})`);
});

const disableScheduler = String(process.env.DISABLE_ALERT_SCHEDULER || '').toLowerCase();
if (!['true', '1', 'yes'].includes(disableScheduler) && process.env.NODE_ENV !== 'test') {
  try {
    startAlertScheduler();
  } catch (err) {
    console.error('[alerts] falha ao iniciar agendador', err);
  }
}

process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM. Encerrando servidor...');
  server.close(async () => {
    try { await db.end(); } catch {}
    process.exit(0);
  });
});
process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT. Encerrando servidor...');
  server.close(async () => {
    try { await db.end(); } catch {}
    process.exit(0);
  });
});

process.on('uncaughtException', err => {
  console.error('❌ Exceção não capturada:', err);
  db.end().finally(() => process.exit(1));
});
process.on('unhandledRejection', reason => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  db.end().finally(() => process.exit(1));
});

module.exports = app;
