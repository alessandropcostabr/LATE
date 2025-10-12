// utils/passwordPolicy.js
// Regras centralizadas de validação de senha (backend).

const COMMON_PATTERNS = [
  'senha',
  'password',
  'teste',
  'qwerty',
  'admin',
  'letmein',
  'welcome',
];

const SIMPLE_SEQUENCES = [
  '0123',
  '1234',
  '2345',
  '3456',
  '4567',
  '5678',
  '6789',
  '7890',
  '0987',
  '9876',
  '8765',
  '7654',
  '6543',
  '5432',
  '4321',
  '3210',
  '0000',
  '1111',
  '2222',
  '3333',
  '4444',
  '5555',
  '6666',
  '7777',
  '8888',
  '9999',
  'abcd',
  'bcde',
  'cdef',
];

function hasLettersAndNumbers(value) {
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
}

function containsCommonPatterns(value) {
  const lower = value.toLowerCase();
  return COMMON_PATTERNS.some((pattern) => lower.includes(pattern));
}

function containsSimpleSequences(value) {
  const lower = value.toLowerCase();
  return SIMPLE_SEQUENCES.some((seq) => lower.includes(seq));
}

function containsEmailParts(password, email) {
  if (!email) return false;
  const lowerPassword = password.toLowerCase();
  const emailLower = String(email || '').trim().toLowerCase();
  if (!emailLower) return false;
  const [localPart] = emailLower.split('@');
  const parts = new Set();
  if (localPart) {
    parts.add(localPart);
    localPart
      .split(/[\W_]+/)
      .filter(Boolean)
      .forEach((piece) => parts.add(piece));
  }
  emailLower
    .split(/[\W_]+/)
    .filter(Boolean)
    .forEach((piece) => parts.add(piece));

  return Array.from(parts)
    .filter((piece) => piece.length >= 3)
    .some((piece) => lowerPassword.includes(piece));
}

function isValidDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (y < 1900 || y > 2099) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;

  const lastDay = new Date(y, m, 0).getDate();
  return d <= lastDay;
}

function containsBirthdayPattern(value) {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 6) return false;

  for (let i = 0; i <= digits.length - 8; i += 1) {
    const chunk = digits.slice(i, i + 8);
    if (chunk.length < 8) continue;
    const yyyy = chunk.slice(0, 4);
    const mm = chunk.slice(4, 6);
    const dd = chunk.slice(6, 8);
    if (isValidDate(yyyy, mm, dd)) return true; // formato yyyymmdd
    const altDd = chunk.slice(0, 2);
    const altMm = chunk.slice(2, 4);
    const altYyyy = chunk.slice(4, 8);
    if (isValidDate(altYyyy, altMm, altDd)) return true; // formato ddmmyyyy
  }

  // Checa formato DDMMAA
  for (let i = 0; i <= digits.length - 6; i += 1) {
    const chunk = digits.slice(i, i + 6);
    if (chunk.length < 6) continue;
    const dd = chunk.slice(0, 2);
    const mm = chunk.slice(2, 4);
    const yy = chunk.slice(4, 6);
    const century = Number(yy) <= 30 ? 2000 : 1900;
    if (isValidDate(century + Number(yy), mm, dd)) return true;
  }

  return false;
}

function validatePassword(password, { email } = {}) {
  const value = String(password || '').trim();
  const errors = [];

  if (value.length < 8) {
    errors.push('A senha deve ter pelo menos 8 caracteres.');
  }

  if (!hasLettersAndNumbers(value)) {
    errors.push('A senha precisa misturar letras e números.');
  }

  if (containsCommonPatterns(value) || containsSimpleSequences(value)) {
    errors.push('A senha não pode usar palavras comuns ou sequências óbvias.');
  }

  if (containsEmailParts(value, email)) {
    errors.push('A senha não pode reutilizar partes do seu e-mail.');
  }

  if (containsBirthdayPattern(value)) {
    errors.push('A senha não deve conter datas de aniversário ou sequências numéricas.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validatePassword,
};
