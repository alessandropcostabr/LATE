BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'OPERADOR',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_role_valid CHECK (role IN ('ADMIN', 'SUPERVISOR', 'OPERADOR', 'LEITOR'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  call_date DATE,
  call_time TIME,
  recipient TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  sender_email TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  callback_time TEXT,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT messages_status_valid CHECK (status IN ('pending', 'in_progress', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_messages_status ON messages (status);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages (recipient);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);

COMMIT;
