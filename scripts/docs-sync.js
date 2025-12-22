#!/usr/bin/env node

// scripts/docs-sync.js
// Gera parciais EJS a partir de Markdown/HTML em docs/**.

const fs = require('fs');
const path = require('path');
async function loadMarked() {
  const mod = await import('marked');
  return mod.marked || mod.default || mod;
}

const ROOT = path.resolve(__dirname, '..');

const targets = [
  {
    source: 'docs/manuals/manual-operacional.md',
    output: 'views/partials/manual-content.ejs',
  },
  {
    source: 'docs/news/news.md',
    output: 'views/partials/news-content.ejs',
  },
];

function readFile(relPath) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Arquivo não encontrado: ${relPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function writeFile(relPath, content) {
  const fullPath = path.join(ROOT, relPath);
  fs.writeFileSync(fullPath, content, 'utf8');
}

function renderMarkdown(md) {
  return renderMarkdown.marked.parse(md);
}

async function syncDocs() {
  const marked = await loadMarked();
  marked.setOptions({
    mangle: false,
    headerIds: false,
  });
  renderMarkdown.marked = marked;
  targets.forEach(({ source, output }) => {
    const raw = readFile(source);
    const html = renderMarkdown(raw);
    writeFile(output, html);
    console.log(`[docs-sync] ${source} -> ${output}`);
  });
}

syncDocs().catch((err) => {
  console.error('[docs-sync] falha:', err.message || err);
  process.exit(1);
});
