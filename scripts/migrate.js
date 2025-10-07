#!/usr/bin/env node
/**
 * Runner de migrações PostgreSQL para o projeto LATE.
 * - Identificadores em inglês; comentários/erros em pt-BR.
 * - Aplica arquivos .sql em migrations/ por ordem, registrando em schema_migrations.
 * - Transação por arquivo, exceto quando o .sql já contém BEGIN/COMMIT.
 */

const fs = require('fs');
const path = require('path');
const dbManager = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const MIGRATIONS_TABLE = 'schema_migrations';
const isDryRun = process.argv.includes('--dry-run');

function listSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/**
 * Detecta se o SQL já possui controle explícito de transação.
 * Cobre padrões comuns:
 *  - BEGIN;
 *  - BEGIN TRANSACTION;
 *  - COMMIT;
 *  - (ignora comentários -- e /* *\/)
 */
function hasOwnTransaction(sqlText) {
  // Remove comentários de linha e bloco para evitar falsos positivos
  const withoutLineComments = sqlText.replace(/--.*$/gm, '');
  const withoutBlockComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, '');
  const normalized = withoutBlockComments.toUpperCase();

  const hasBegin = /\bBEGIN(?:\s+TRANSACTION)?\s*;/.test(normalized);
  const hasCommit = /\bCOMMIT\s*;/.test(normalized);

  return hasBegin && hasCommit;
}

async function ensureMigrationsTable(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await db.exec(sql);
}

async function getApplied(db) {
  try {
    const stmt = db.prepare(`SELECT filename FROM ${MIGRATIONS_TABLE} ORDER BY filename ASC`);
    const rows = await stmt.all();
    return new Set((rows || []).map(r => r.filename));
  } catch (e) {
    return new Set();
  }
}

async function markApplied(db, filename) {
  const stmt = db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES (${dbManager.placeholder(1)})`);
  await stmt.run([filename]);
}

async function applyFileTransactional(filename, sqlText) {
  const transformed = sqlText;

  // Se o arquivo já tem BEGIN/COMMIT, não envolver em outra transação.
  if (hasOwnTransaction(transformed)) {
    const db = dbManager.getDatabase();
    await db.exec(transformed);
    return;
  }

  // Caso contrário, executa em uma transação por arquivo.
  return dbManager.transaction(async (db) => {
    await db.exec(transformed);
  });
}

(async function main() {
  dbManager.adapter();
  const db = dbManager.getDatabase();

  const files = listSqlFiles(MIGRATIONS_DIR);
  if (files.length === 0) {
    console.info('[migrate] Nenhum arquivo .sql encontrado em migrations/.');
    await dbManager.close();
    process.exit(0);
  }

  try {
    await ensureMigrationsTable(db);
  } catch (e) {
    console.error('[migrate] ERRO ao garantir tabela de migrações:', e.message);
    await dbManager.close();
    process.exit(1);
  }

  const applied = await getApplied(db);
  const pendentes = files.filter(f => !applied.has(f));

  if (pendentes.length === 0) {
    console.info('[migrate] Não há migrações pendentes.');
    await dbManager.close();
    process.exit(0);
  }

  console.info('[migrate] Driver ativo: pg');
  console.info('[migrate] Arquivos pendentes:', pendentes);

  if (isDryRun) {
    console.info('[migrate] Modo --dry-run: nenhuma migração será aplicada.');
    await dbManager.close();
    process.exit(0);
  }

  for (const fname of pendentes) {
    const full = path.join(MIGRATIONS_DIR, fname);
    const sqlText = fs.readFileSync(full, 'utf8');
    console.info(`[migrate] Aplicando: ${fname} ...`);
    try {
      await applyFileTransactional(fname, sqlText);
      await markApplied(db, fname);
      console.info(`[migrate] OK: ${fname}`);
    } catch (err) {
      console.error(`[migrate] ERRO ao aplicar ${fname}:`, err.message);
      await dbManager.close();
      process.exit(1);
    }
  }

  await dbManager.close();
  console.info('[migrate] Concluído com sucesso.');
  process.exit(0);
})().catch(async (e) => {
  console.error('[migrate] Falha inesperada:', e);
  try { await dbManager.close(); } catch {}
  process.exit(1);
});
