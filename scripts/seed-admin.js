#!/usr/bin/env node

require('dotenv').config();

const argon2 = require('argon2');
const UserModel = require('../models/user');
const database = require('../config/database');

async function main() {
  const name = (process.env.ADMIN_NAME || 'Administrador').trim();
  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'trocar-senha';

  if (!email) {
    console.error('[seed-admin] É necessário definir ADMIN_EMAIL (ou ajustar no script).');
    process.exit(1);
  }

  if (!password) {
    console.error('[seed-admin] É necessário definir ADMIN_PASSWORD (ou ajustar no script).');
    process.exit(1);
  }

  try {
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      console.info(`[seed-admin] Usuário administrador já existe: ${email}`);
      return;
    }

    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    await UserModel.create({ name, email, password_hash, role: 'ADMIN' });
    console.info(`[seed-admin] Usuário administrador criado: ${email}`);
  } catch (err) {
    console.error('[seed-admin] Falha ao criar usuário administrador:', err.message);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}

main();
