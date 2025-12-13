// utils/normalizeContact.js
// Funções de normalização de telefone/e-mail para contatos.
// Telefones usam utils/phone (E.164, sem o '+', apenas dígitos) para deduplicação.

const { normalizePhone: normalizePhoneE164Digits } = require('./phone');

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeEmail(value) {
  const text = normalizeText(value);
  if (!text) return null;
  return text.toLowerCase();
}

function normalizePhone(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const normalized = normalizePhoneE164Digits(text);
  return normalized === '' ? null : normalized;
}

function buildContactKey({ phone, email }) {
  const phoneKey = normalizePhone(phone) || '';
  const emailKey = normalizeEmail(email) || '';
  if (!phoneKey && !emailKey) return null;
  return `${emailKey}#${phoneKey}`;
}

function normalizeContactPayload({ name, phone, email } = {}) {
  const normalizedName = normalizeText(name);
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedPhone && !normalizedEmail) {
    return null;
  }
  return {
    name: normalizedName,
    phone: normalizedPhone,
    email: normalizedEmail,
    phoneNormalized: normalizedPhone || '',
    emailNormalized: normalizedEmail || '',
  };
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  buildContactKey,
  normalizeContactPayload,
};
