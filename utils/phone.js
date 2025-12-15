// utils/phone.js
// Normalização de telefones usando a lib "phone" (E.164). Retorna apenas dígitos para lookup.

const { phone } = require('phone');

function normalizePhone(raw) {
  if (raw === null || raw === undefined) return '';
  const str = String(raw).trim();
  try {
    const res = phone(str, { country: 'BRA', validate: true });
    if (res.isValid && res.phoneNumber) {
      return res.phoneNumber.replace(/\D+/g, ''); // strip '+'
    }
  } catch (err) {
    // ignore and fallback
  }
  return str.replace(/\D+/g, '');
}

module.exports = { normalizePhone };
