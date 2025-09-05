-- 04_seed_admin.sql (idempotente)
-- Garante um admin; NÃO sobrescreve a senha de quem já existe.

INSERT INTO users (name, email, password_hash, role, is_active)
VALUES ('Administrador', 'contato@amah.com.br', '$argon2id$v=19$m=65536,t=3,p=1$dvcNSjbgcmcnvCgpIZPqTQ$S0EmFlqfFwCDM+xF5tzfYW2fxsx23Cl8udn3ywteOCE', 'ADMIN', 1)
ON CONFLICT(email) DO UPDATE SET
  name      = excluded.name,
  role      = excluded.role,
  is_active = excluded.is_active;
