#!/usr/bin/env node

/**
 * scripts/docs-sync.js
 *
 * Converte arquivos Markdown em fragmentos EJS (HTML) com base em uma configuração simples.
 * Uso:
 *   node scripts/docs-sync.js                # processa config padrão
 *   node scripts/docs-sync.js --config foo.json
 *
 * Cada entrada da config deve ter:
 *   { "source": "manual-operacional.md", "output": "views/partials/manual-content.ejs" }
 */

const fs = require('fs');
const path = require('path');
const process = require('process');
const { marked } = require('marked');

const DEFAULT_CONFIG = path.join(__dirname, 'docs-sync.config.json');

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Falha ao ler configuração "${filePath}": ${err.message}`);
  }
}

function resolvePath(relativePath) {
  const cwd = process.cwd();
  return path.resolve(cwd, relativePath);
}

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function renderMarkdown(mdContent, sourcePath) {
  marked.setOptions({
    mangle: false,
    headerIds: true,
  });
  return marked.parse(mdContent, { baseUrl: sourcePath });
}

function processEntry(entry) {
  const absoluteSource = resolvePath(entry.source);
  const absoluteOutput = resolvePath(entry.output);

  if (!fs.existsSync(absoluteSource)) {
    throw new Error(`Arquivo fonte não encontrado: ${entry.source}`);
  }

  const mdContent = fs.readFileSync(absoluteSource, 'utf8');
  const html = renderMarkdown(mdContent, path.dirname(absoluteSource));
  ensureDirExists(absoluteOutput);
  fs.writeFileSync(absoluteOutput, `${html.trim()}\n`, 'utf8');
  console.log(`[docs-sync] ${entry.source} → ${entry.output}`);
}

function main() {
  const args = process.argv.slice(2);
  const configFlagIndex = args.findIndex((arg) => arg === '--config');
  let configPath = DEFAULT_CONFIG;

  if (configFlagIndex !== -1) {
    const next = args[configFlagIndex + 1];
    if (!next) {
      console.error('[docs-sync] Uso: --config <arquivo.json>');
      process.exit(1);
      return;
    }
    configPath = resolvePath(next);
  }

  const config = readJson(configPath);
  if (!Array.isArray(config) || config.length === 0) {
    console.warn('[docs-sync] Nenhuma entrada encontrada na configuração.');
    return;
  }

  config.forEach((entry) => {
    if (!entry?.source || !entry?.output) {
      console.warn('[docs-sync] Entrada ignorada por falta de campos "source" ou "output":', entry);
      return;
    }
    processEntry(entry);
  });

  console.log('[docs-sync] Concluído.');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[docs-sync] Erro:', err.message);
    process.exitCode = 1;
  }
}
