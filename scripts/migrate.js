const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
const migrationsDir = path.join(dataDir, 'migrations');
const dbPath = path.join(dataDir, 'recados.db');
const sessionDb = path.join(dataDir, 'sessions.sqlite');

// Garante arquivo para store de sessão
fs.mkdirSync(dataDir, { recursive: true });
fs.closeSync(fs.openSync(sessionDb, 'a'));

const db = new Database(dbPath);

try {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const statements = sql
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      db.exec('BEGIN');
      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err) {
          const msg = err.message.toLowerCase();
          if (
            msg.includes('duplicate column name') ||
            msg.includes('no such column') ||
            msg.includes('already exists')
          ) {
            console.warn(`[migrate] Skipping statement in ${file}: ${err.message}`);
          } else {
            throw err;
          }
        }
      }
      db.exec('COMMIT');
      console.info(`[migrate] Executed ${file}`);
    } catch (err) {
      db.exec('ROLLBACK');
      console.error(`[migrate] Error executing ${file}: ${err.message}`);
      throw err;
    }
  }
  console.info('[migrate] All migrations executed successfully');
} catch (err) {
  console.error('[migrate] Migration process failed');
} finally {
  db.close();
}
