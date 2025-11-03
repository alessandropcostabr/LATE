// utils/hashToken.js
// Geração de hash SHA-256 para tokens de intake (com pepper opcional).

const crypto = require('crypto');

function hashToken(token) {
  const pepper = process.env.INTAKE_TOKEN_PEPPER || '';
  return crypto
    .createHash('sha256')
    .update(String(token ?? '') + pepper)
    .digest('hex');
}

module.exports = { hashToken };
