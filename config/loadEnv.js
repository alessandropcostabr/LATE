// config/loadEnv.js
// Carrega variáveis de ambiente do arquivo adequado (.env, .env.prod etc.), permitindo overrides.

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let cachedPath = null;
let alreadyLoaded = false;

function resolveCandidates() {
  const projectRoot = path.join(__dirname, '..');

  const explicit = process.env.DOTENV_FILE || process.env.ENV_FILE;
  if (explicit) {
    const absolute = path.isAbsolute(explicit) ? explicit : path.join(projectRoot, explicit);
    return [absolute];
  }

  const env = String(process.env.NODE_ENV || '').toLowerCase();
  const candidates = [];

  if (env === 'production') {
    candidates.push('.env.prod', '.env.production');
  } else if (env === 'test') {
    candidates.push('.env.test');
  } else if (env === 'development') {
    candidates.push('.env.dev');
  }

  candidates.push('.env.local', '.env');

  const unique = [...new Set(candidates.filter(Boolean))];
  return unique.map((file) => path.join(projectRoot, file));
}

function firstExisting(files) {
  for (const file of files) {
    if (!file) continue;
    try {
      const stat = fs.statSync(file);
      if (stat.isFile()) return file;
    } catch (_err) {
      // Ignora ausência
    }
  }
  return null;
}

function loadEnv(options = {}) {
  if (alreadyLoaded && !options.force) {
    return cachedPath;
  }

  const candidates = resolveCandidates();
  const target = firstExisting(candidates);

  if (!target) {
    if (!alreadyLoaded) {
      console.warn('[env] Nenhum arquivo .env encontrado; usando variáveis já definidas no ambiente.');
    }
    alreadyLoaded = true;
    cachedPath = null;
    return null;
  }

  dotenv.config({ path: target, override: Boolean(options.override), quiet: true });
  cachedPath = target;
  alreadyLoaded = true;

  if (!options.silent) {
    console.info(`[env] Variáveis carregadas de ${path.relative(process.cwd(), target)}`);
  }

  return cachedPath;
}

function getLoadedEnvPath() {
  return cachedPath;
}

module.exports = {
  loadEnv,
  getLoadedEnvPath,
};
