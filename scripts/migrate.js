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

  db.exec(
    'CREATE TABLE IF NOT EXISTS migrations_meta (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, run_on DATETIME DEFAULT CURRENT_TIMESTAMP)'
  );

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
      const base = path.basename(file, '.sql');
      const applied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);
      const metaApplied = db.prepare('SELECT 1 FROM migrations_meta WHERE name = ?').get(base);
      if (applied || metaApplied) {
        console.info(`[migrate] Skipping already applied ${file}`);
        if (!applied && metaApplied)
          db.prepare('INSERT OR IGNORE INTO _migrations(name) VALUES (?)').run(file);
        continue;
      }

      if (file === '08_recados_add_created_at.sql') {
        const hasCreatedAt = db
          .prepare("SELECT 1 FROM pragma_table_info('recados') WHERE name = 'created_at'")
          .get();
        if (hasCreatedAt) {
          db.prepare('INSERT OR IGNORE INTO migrations_meta(name) VALUES (?)').run(base);
          db.prepare('INSERT OR IGNORE INTO _migrations(name) VALUES (?)').run(file);
          console.info(`[migrate] Skipping ${file}; created_at already exists`);
          continue;
        }
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        db.exec(sql);
      } catch (err) {
        const msg = err.message.toLowerCase();
        if (
          msg.includes('duplicate column name') ||
          msg.includes('no such column') ||
          msg.includes('already exists') ||
          msg.includes('cannot start a transaction')
        ) {
          console.warn(`[migrate] Skipping statements in ${file}: ${err.message}`);
        } else {
          throw err;
        }
      }

      db.prepare('INSERT OR IGNORE INTO migrations_meta(name) VALUES (?)').run(base);
      db.prepare('INSERT INTO _migrations(name) VALUES (?)').run(file);
      console.info(`[migrate] Executed ${file}`);
  }
  console.info('[migrate] All migrations executed successfully');
} finally {
  db.close();
}
