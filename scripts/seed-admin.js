// scripts/seed-admin.js
// Seed de administrador **somente PostgreSQL** (ignora SQLite)
// Comentários em pt-BR; identificadores em inglês.
// Uso:
//   ADMIN_EMAIL=admin@local.test ADMIN_PASSWORD='SenhaForte!1' node scripts/seed-admin.js
//   (as variáveis PG_* já vêm do ecosystem.config.js; este script lê ambos formatos PG_HOST/PGHOST etc.)

require('dotenv').config(); // opcional: carrega .env se existir
const { Pool } = require('pg');
const argon2 = require('argon2');

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
  const pwd   = String(process.env.ADMIN_PASSWORD || '').trim();

  if (!email) {
    console.error('ADMIN_EMAIL é obrigatório.');
    process.exit(1);
  }

  // --- Guard-rail: garante PG ---
  if (process.env.DB_DRIVER && String(process.env.DB_DRIVER).toLowerCase() !== 'pg') {
    console.error('[seed-admin] DB_DRIVER não é "pg". Aborte ou defina DB_DRIVER=pg.');
    process.exit(2);
  }

  // --- Conexão PG ---
  const pool = new Pool({
    host:     pick('PG_HOST', 'PGHOST') || '127.0.0.1',
    port:     Number(pick('PG_PORT', 'PGPORT') || 5432),
    user:     pick('PG_USER', 'PGUSER'),
    password: pick('PG_PASSWORD', 'PGPASSWORD'),
    database: pick('PG_DATABASE', 'PGDATABASE'),
    ssl:      process.env.PG_SSL === '1'
  });

  const client = await pool.connect();
  try {
    const password_hash = await argon2.hash(pwd || 'Troque123!A', { type: argon2.argon2id });

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
    if (!pwd) console.info('[seed-admin] Senha padrão usada: Troque123!A (recomenda-se definir ADMIN_PASSWORD).');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[seed-admin] falhou:', e);
    process.exit(3);
  } finally {
    client.release();
    await pool.end();
  }
})();
