// server.js — foco DEV estável
// Arquitetura: Express 5 + EJS + SQLite (better-sqlite3) + sessions

// ─── Imports base ────────────────────────────────────────────────────────────
const express = require('express');
const corsMw = require('./middleware/cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');
const compression = require('compression');
require('dotenv').config(); // carrega .env

// Importar middlewares e rotas
const dbManager = require('./config/database');
const apiRoutes = require('./routes/api');
const webRoutes = require('./routes/web');

// Middleware opcional para validar origem (carrega só se existir)
let validateOrigin;
try { validateOrigin = require('./middleware/validateOrigin'); } catch { validateOrigin = null; }

// ─── Flags/Ambiente ─────────────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Em ambiente atrás de proxy (ex.: Nginx), confiar no proxy somente em produção.
// Em DEV, manter 0 para não bagunçar req.secure e flags de cookie.
const TRUST_PROXY = Number(process.env.TRUST_PROXY ?? (isProd ? 1 : 0));

// ─── App Express ─────────────────────────────────────────────────────────────
const app = express();

// Evita ETag/304 para simplificar debug no DEV
app.set('etag', false);
app.set('trust proxy', TRUST_PROXY);

// Helmet compatível em DEV (CSP endurecida entra na Sprint 5 com nonce/hash)
app.use(helmet({ contentSecurityPolicy: false }));

console.log(`[BOOT] trust proxy = ${app.get('trust proxy')}, NODE_ENV=${process.env.NODE_ENV || 'undefined'}`);

// Define o caminho do CSS baseado no ambiente
app.locals.cssFile = isProd ? '/css/style.min.css' : '/css/style.css';

// ─── View Engine ─────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── CORS / Pré-flight ───────────────────────────────────────────────────────
app.use(corsMw);
// Express 5 + path-to-regexp v7: use regex para OPTIONS global
app.options(/.*/, corsMw, (req, res) => {
  res.setHeader('Access-Control-Allow-Methods', corsMw.ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', corsMw.ALLOWED_HEADERS);
  res.sendStatus(204);
});

// Validação de origem (se fornecida) apenas em produção
if (isProd && validateOrigin) app.use(validateOrigin);

// ─── Rate Limiters ──────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  skip: req => req.method !== 'POST'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: req => req.method === 'OPTIONS'
});

// ─── Estáticos / Logs / Body Parsers / Compressão ───────────────────────────
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use(morgan('combined'));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Sessão (ÚNICA) ─────────────────────────────────────────────────────────
// Por quê: estabilidade em DEV (HTTP), segurança em PROD (HTTPS)
app.use(session({
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET || 'trocar-este-segredo-em-producao',
  resave: false,
  rolling: true,
  saveUninitialized: false,
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: path.join(__dirname, 'data') }),
  cookie: {
    httpOnly: true,
    secure: isProd,       // true somente atrás de HTTPS real (PROD)
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 4 // 4h
  }
}));

// Disponibiliza o usuário logado nas views
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// ─── Cache-control básico ────────────────────────────────────────────────────
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

// ─── Bundlers leves p/ JS público (mantidos) ────────────────────────────────
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

// Estáticos raiz
app.use(express.static(path.join(__dirname, 'public')));

// Safety default para templates EJS
app.use((req, res, next) => {
  if (!Array.isArray(res.locals.errors)) res.locals.errors = [];
  next();
});

// Healthcheck
app.get('/health', (_req, res) => res.status(200).json({ success: true, data: { status: 'ok' } }));

// ─── Rotas ───────────────────────────────────────────────────────────────────
app.use('/login', loginLimiter);
app.use('/api', apiLimiter);
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// ─── Tratamento de erros ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Erro não tratado:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ success: false, error: 'Endpoint não encontrado' });
  } else {
    res.status(404).render('404');
  }
});

// ─── Inicialização / Shutdown ────────────────────────────────────────────────
// Em Cloudflare Tunnel, mantenha o app só em loopback:
const HOST = process.env.HOST || '127.0.0.1';
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'dev'})`);
});

process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM. Encerrando servidor...');
  dbManager.close();
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT. Encerrando servidor...');
  dbManager.close();
  server.close(() => process.exit(0));
});

process.on('uncaughtException', err => {
  console.error('❌ Exceção não capturada:', err);
  dbManager.close();
  process.exit(1);
});
process.on('unhandledRejection', reason => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  dbManager.close();
  process.exit(1);
});

module.exports = app;
