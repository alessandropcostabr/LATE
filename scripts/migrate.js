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
  db.exec(
    "CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)"
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let inTx = false;
  try {
    db.exec('BEGIN');
    inTx = true;

    for (const file of files) {
      const applied = db
        .prepare('SELECT 1 FROM _migrations WHERE name = ?')
        .get(file);
      if (applied) {
        console.info(`[migrate] Skipping already applied ${file}`);
        continue;
      }

      if (file === '08_recados_add_created_at.sql') {
        const hasCreatedAt = db
          .prepare("SELECT 1 FROM pragma_table_info('recados') WHERE name = 'created_at'")
          .get();
        if (hasCreatedAt) {
          db.exec(
            'CREATE TABLE IF NOT EXISTS migrations_meta (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, run_on DATETIME DEFAULT CURRENT_TIMESTAMP)'
          );
          db.prepare('INSERT OR IGNORE INTO _migrations(name) VALUES (?)').run(file);
          db.prepare(
            "INSERT OR IGNORE INTO migrations_meta(name) VALUES ('08_recados_add_created_at')"
          ).run();
          console.info(`[migrate] Skipping ${file}; created_at already exists`);
          continue;
        }
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const statements = sql
        .split(/;\s*(?:\n|$)/)
        .map((s) => s.trim())
        .filter(Boolean);

      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (err) {
          const msg = err.message.toLowerCase();
          if (
            msg.includes('duplicate column name') ||
            msg.includes('no such column') ||
            msg.includes('already exists') ||
            msg.includes('cannot start a transaction')
          ) {
            console.warn(`[migrate] Skipping statement in ${file}: ${err.message}`);
          } else {
            throw err;
          }
        }
      }

      if (file === '08_recados_add_created_at.sql') {
        db
          .prepare(
            "INSERT OR IGNORE INTO migrations_meta(name) VALUES ('08_recados_add_created_at')"
          )
          .run();
      }
      db.prepare('INSERT INTO _migrations(name) VALUES (?)').run(file);
      console.info(`[migrate] Executed ${file}`);
    }

    db.exec('COMMIT');
    inTx = false;
    console.info('[migrate] All migrations executed successfully');
  } catch (err) {
    if (inTx) db.exec('ROLLBACK');
    console.error(`[migrate] Migration process failed: ${err.message}`);
    throw err;
  }
} finally {
  db.close();
}
