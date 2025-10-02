#!/usr/bin/env node

require('dotenv').config();

const crypto = require('crypto');
const argon2 = require('argon2');
const UserModel = require('../models/user');
const database = require('../config/database');

async function main() {
  const name = (process.env.ADMIN_NAME || 'Administrador').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD.trim() : '';

  if (!email) {
    console.error('[seed-admin] É necessário definir ADMIN_EMAIL com o endereço do administrador.');
    process.exit(1);
  }

  try {
    const existing = await UserModel.findByEmail(email);
    if (existing) {
      console.info(`[seed-admin] Usuário administrador já existe: ${email}`);
      return;
    }

    let password = envPassword;
    let generatedPassword = null;

    if (!password) {
      try {
        generatedPassword = crypto.randomBytes(32).toString('hex');
        password = generatedPassword;
        console.info('[seed-admin] ADMIN_PASSWORD não definido. Senha forte gerada automaticamente.');
      } catch (err) {
        console.error(`[seed-admin] Não foi possível gerar uma senha para o administrador: ${err.message}`);
        process.exitCode = 1;
        return;
      }
    }

    if (!password) {
      console.error('[seed-admin] Não foi possível determinar uma senha de administrador. Defina ADMIN_PASSWORD e tente novamente.');
      process.exitCode = 1;
      return;
    }

    const password_hash = await argon2.hash(password, { type: argon2.argon2id });
    await UserModel.create({ name, email, password_hash, role: 'ADMIN' });
    console.info(`[seed-admin] Usuário administrador criado: ${email}`);

    if (generatedPassword) {
      console.info('[seed-admin] Senha do administrador (salve em local seguro):');
      console.info(generatedPassword);
    } else {
      console.info('[seed-admin] Senha definida a partir de ADMIN_PASSWORD.');
    }
  } catch (err) {
    console.error('[seed-admin] Falha ao criar usuário administrador:', err.message);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}

main();
