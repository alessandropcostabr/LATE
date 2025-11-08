// config/sessionSecret.js
// Resolve a chave da sessão com validações mínimas para evitar segredos fracos em produção.

const DEFAULT_SECRET = 'trocar-este-segredo-em-producao';

function resolveSessionSecret({ isProd }) {
  const raw = String(process.env.SESSION_SECRET || '').trim();

  if (isProd) {
    if (!raw) {
      throw new Error('SESSION_SECRET ausente em produção');
    }
    if (raw === DEFAULT_SECRET) {
      throw new Error('SESSION_SECRET não pode usar o valor padrão em produção');
    }
    return raw;
  }

  if (!raw) {
    console.warn('[session] SESSION_SECRET ausente; usando valor padrão para ambiente não-produtivo');
    return DEFAULT_SECRET;
  }

  if (raw === DEFAULT_SECRET) {
    console.warn('[session] SESSION_SECRET está usando o valor padrão; substitua em ambiente produtivo');
  }

  return raw;
}

module.exports = {
  DEFAULT_SECRET,
  resolveSessionSecret,
};
