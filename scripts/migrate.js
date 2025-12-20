#!/usr/bin/env node
'use strict';

// scripts/migrate.js
// Migrador simples para arquivos .sql em migrations/ (ordem alfanumérica).
// - Respeita DB_DRIVER=pg (falha se diferente)
// - Usa tabela schema_migrations para controle de arquivos aplicados
// - --dry-run lista o que seria aplicado
// Comentários em pt-BR; identificadores em inglês.

const fs = require('fs');
const path = require('path');

const pool = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const TABLE = 'schema_migrations';
const NOOP_FILE = '99999999_noop.sql';

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((filename) => filename.endsWith('.sql') && filename !== NOOP_FILE)
    .sort((a, b) => a.localeCompare(b));
}

function hasOwnTransaction(sqlText) {
  const cleaned = String(sqlText || '')
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .toUpperCase();
  return /\bBEGIN\b/.test(cleaned) && /\bCOMMIT\b/.test(cleaned);
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(`SELECT filename FROM ${TABLE}`);
  return new Set(rows.map((r) => r.filename));
}

async function applyMigration(client, filename, sqlText) {
  if (hasOwnTransaction(sqlText)) {
    await client.query(sqlText);
    return;
  }

  await client.query('BEGIN');
  try {
    await client.query(sqlText);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const driver = String(process.env.DB_DRIVER || 'pg').toLowerCase();
  if (driver !== 'pg') {
    console.error('[migrate] DB_DRIVER inválido:', process.env.DB_DRIVER, '→ use "pg".');
    process.exit(1);
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    console.log('[migrate] Nenhum arquivo .sql encontrado em migrations/.');
    return;
  }

  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log('[migrate] Nenhuma migração pendente.');
      return;
    }

    console.log(`[migrate] Pendentes: ${pending.length}`);
    for (const filename of pending) {
      if (dryRun) {
        console.log(`[dry-run] aplicaria: ${filename}`);
        continue;
      }

      const fullpath = path.join(MIGRATIONS_DIR, filename);
      const sqlText = fs.readFileSync(fullpath, 'utf8');

      console.log(`[migrate] aplicando: ${filename}`);
      await applyMigration(client, filename, sqlText);
      await client.query(
        `INSERT INTO ${TABLE} (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
        [filename]
      );
      console.log(`[migrate] ok: ${filename}`);
    }

    if (dryRun) {
      console.log('[migrate] DRY RUN concluído (nenhuma alteração aplicada).');
    } else {
      console.log('[migrate] Todas as migrações pendentes foram aplicadas.');
    }
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[migrate] ERRO:', err?.message || err);
  process.exitCode = 1;
});

