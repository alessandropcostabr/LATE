#!/usr/bin/env node

// scripts/migrate.js
// Migrador simples para arquivos .sql em migrations/ (ordem alfanumérica).
// - Respeita DB_DRIVER=pg (falha se diferente)
// - Carrega .env.production -> .env (fallback)
// - Usa tabela schema_migrations para controle de arquivos aplicados
// - --dry-run lista o que seria aplicado
// Comentários em pt-BR; identificadores em inglês.

const fs = require('fs');
const path = require('path');
// Carrega .env apropriado (.env ou .env.prod) antes de qualquer leitura de process.env
require('../config/loadEnv').loadEnv();

// Barrar drivers não suportados
const driver = String(process.env.DB_DRIVER || 'pg').toLowerCase();
if (driver !== 'pg') {
  console.error('[migrate] DB_DRIVER inválido:', process.env.DB_DRIVER, '→ use "pg".');
  process.exit(1);
}

// Diagnóstico: confirmar variáveis críticas antes de abrir conexão
console.info(
  '[migrate] NODE_ENV=%s DB=%s USER=%s HOST=%s PORT=%s SSL=%s',
  process.env.NODE_ENV,
  process.env.PGDATABASE,
  process.env.PGUSER,
  process.env.PGHOST,
  process.env.PGPORT,
  String(process.env.PG_SSL ?? process.env.PGSSLMODE ?? '0')
);

const pool = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const TABLE = 'schema_migrations';

// Detecta se o arquivo .sql já tem controle de transação próprio
function hasOwnTransaction(sql) {
  // Ignora comentários simples e procura padrões BEGIN/COMMIT
  const cleaned = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .toUpperCase();
  return cleaned.includes('BEGIN;') && cleaned.includes('COMMIT;');
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query(`SELECT filename FROM ${TABLE}`);
  return new Set(rows.map(r => r.filename));
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

async function applyMigration(client, filename, dryRun = false) {
  const fullpath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(fullpath, 'utf8');

  if (dryRun) {
    console.log(`[dry-run] aplicaria: ${filename}`);
    return;
  }

  console.log(`[migrate] aplicando: ${filename}`);

  if (hasOwnTransaction(sql)) {
    // Arquivo já controla BEGIN/COMMIT
    await client.query(sql);
  } else {
    // Enrola em transação
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  await client.query(
    `INSERT INTO ${TABLE} (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING`,
    [filename]
  );

  console.log(`[migrate] ok: ${filename}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const client = await pool.connect();
  try {
    try {
      const { rows } = await client.query("SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'");
      const enabled = rows.length > 0;
      console.info('[migrate] pgcrypto %s', enabled ? 'ATIVO' : 'INATIVO');
      if (!enabled) {
        console.warn('[migrate] Atenção: extensão pgcrypto não encontrada. Execute CREATE EXTENSION IF NOT EXISTS pgcrypto;');
      }
    } catch (err) {
      console.warn('[migrate] Não foi possível verificar a extensão pgcrypto:', err.message || err);
    }

    // Garante tabela de controle
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = listMigrationFiles();

    if (files.length === 0) {
      console.log('[migrate] Nenhum arquivo .sql encontrado em migrations/');
      return;
    }

    const pending = files.filter(f => !applied.has(f));

    if (pending.length === 0) {
      console.log('[migrate] Nenhuma migração pendente.');
      return;
    }

    console.log(`[migrate] Pendentes: ${pending.length}`);
    for (const f of pending) {
      await applyMigration(client, f, dryRun);
    }

    if (dryRun) {
      console.log('[migrate] DRY RUN concluído (nenhuma alteração aplicada).');
    } else {
      console.log('[migrate] Todas as migrações pendentes foram aplicadas.');
    }
  } catch (err) {
    console.error('[migrate] ERRO:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

main();
