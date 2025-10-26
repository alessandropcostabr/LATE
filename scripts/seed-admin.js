// scripts/seed-admin.js
// Seed de administrador para PostgreSQL
// Comentários em pt-BR; identificadores em inglês.
// Uso:
//   ADMIN_EMAIL=admin@local.test ADMIN_PASSWORD='SenhaForte!1' node scripts/seed-admin.js
//   (as variáveis PG_* já vêm do ecosystem.config.js; este script lê ambos formatos PG_HOST/PGHOST etc.)

require('../config/loadEnv').loadEnv(); // Padronizar carregamento do .env/.env.prod
const { Pool } = require('pg');
const argon2 = require('argon2');
const crypto = require('crypto');

// Lê ambos formatos de env para compatibilidade (PG_HOST/PGHOST etc.)
function pick(...keys) {
  for (const k of keys) {
    if (process.env[k] && String(process.env[k]).length) return process.env[k];
  }
  return undefined;
}

(async () => {
  // --- Entrada obrigatória ---
  const email = String(process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const name  = (process.env.ADMIN_NAME || 'Administrador').trim();
  let pwd     = String(process.env.ADMIN_PASSWORD || '').trim();
  const allowRandom = String(process.env.SEED_ALLOW_RANDOM || '').trim() === '1';

  if (!email) {
    console.error('ADMIN_EMAIL é obrigatório.');
    process.exit(1);
  }

  // --- Política de senha do seed ---
  // Não usar senha fixa quando ADMIN_PASSWORD estiver ausente.
  // Padrão: falhar rápido. Para gerar aleatória, defina SEED_ALLOW_RANDOM=1.
  if (!pwd) {
    if (!allowRandom) {
      console.error('[seed-admin] ADMIN_PASSWORD é obrigatório. Para gerar aleatória, use SEED_ALLOW_RANDOM=1.');
      console.error('[seed-admin] Ex.: SEED_ALLOW_RANDOM=1 ADMIN_EMAIL=admin@local.test node scripts/seed-admin.js');
      process.exit(1);
    }
    try {
      // 24 bytes -> base64url ~32 chars; forte e fácil de colar
      const generated = crypto.randomBytes(24).toString('base64url');
      pwd = generated;
      console.warn('────────────────────────────────────────────────────────');
      console.warn('[seed-admin] ADMIN_PASSWORD ausente. Senha TEMPORÁRIA gerada:');
      console.warn(`[seed-admin] ${generated}`);
      console.warn('[seed-admin] Troque a senha após o primeiro login.');
      console.warn('────────────────────────────────────────────────────────');
    } catch (err) {
      console.error(`[seed-admin] Falha ao gerar senha aleatória: ${err.message}`);
      process.exit(1);
    }
  }

  // --- Conexão PG ---

  const sslRequired = (process.env.PG_SSL === '1') || (String(process.env.PGSSLMODE || '').toLowerCase() === 'require');
  console.info(
    '[seed-admin] NODE_ENV=%s DB=%s USER=%s HOST=%s PORT=%s SSL=%s',
    process.env.NODE_ENV,
    pick('PG_DATABASE','PGDATABASE'),
    pick('PG_USER','PGUSER'),
    pick('PG_HOST','PGHOST') || '127.0.0.1',
    pick('PG_PORT','PGPORT') || '5432',
    sslRequired ? 'on' : 'off'
  );

  const pool = new Pool({
    host:     pick('PG_HOST', 'PGHOST') || '127.0.0.1',
    port:     Number(pick('PG_PORT', 'PGPORT') || 5432),
    user:     pick('PG_USER', 'PGUSER'),
    password: pick('PG_PASSWORD', 'PGPASSWORD'),
    database: pick('PG_DATABASE', 'PGDATABASE'),
    ssl:      sslRequired ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();
  try {
    const password_hash = await argon2.hash(pwd, { type: argon2.argon2id });

    await client.query('BEGIN');

    // Garante a tabela users (idempotente); SQL neutro
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            BIGSERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL CHECK (role IN ('ADMIN','SUPERVISOR','OPERADOR','LEITOR')) DEFAULT 'OPERADOR',
        is_active     BOOLEAN NOT NULL DEFAULT TRUE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_email_lower_chk'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_email_lower_chk CHECK (email = lower(email));
        END IF;
      END$$;
    `);

    // UPSERT por e-mail, força ADMIN e ativa o usuário
    await client.query(`
      INSERT INTO users (name, email, password_hash, role, is_active)
      VALUES ($1, LOWER($2), $3, 'ADMIN', TRUE)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        password_hash = EXCLUDED.password_hash,
        role = 'ADMIN',
        is_active = TRUE,
        updated_at = NOW();
    `, [name, email, password_hash]);

    await client.query('COMMIT');
    console.info(`[seed-admin] ADMIN garantido no PostgreSQL: ${email}`);
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[seed-admin] falhou:', e);
    process.exit(3);
  } finally {
    client.release();
    await pool.end();
  }
})();
