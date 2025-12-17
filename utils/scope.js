// utils/scope.js
// Helper para aplicar escopos de visualização (me/team/all) em filtros de owner.
// Versão inicial: suporta "me" e "all". "team" ainda não tem backing field (team_id),
// então é tratado como "all" até termos modelagem de times.

const VALID_SCOPES = ['me', 'team', 'all'];

function normalizeScope(input) {
  const value = String(input || '').toLowerCase();
  if (VALID_SCOPES.includes(value)) return value;
  return 'me';
}

function resolveScope(scopeParam, user = {}) {
  const role = String(user.role || '').toUpperCase();
  const scope = normalizeScope(scopeParam);

  // Admin sempre pode ver tudo
  if (role === 'ADMIN') return 'all';

  // Supervisor ganha team/all; operador fica em me
  if (role === 'SUPERVISOR') {
    if (scope === 'all' || scope === 'team') return scope === 'team' ? 'team' : 'all';
    return 'me';
  }

  // Demais perfis: apenas "me"
  return 'me';
}

function applyOwnerScope(filter = {}, user = {}, scopeParam) {
  const scope = resolveScope(scopeParam, user);
  const result = { ...filter };

  if (scope === 'me') {
    result.owner_id = user.id || null;
  } else if (scope === 'team') {
    // Sem campo team_id por enquanto; fallback para ALL.
    // Futuro: filtrar por team_id via join em users.
  } else {
    // all: não força owner
  }

  return { filter: result, scope };
}

module.exports = {
  normalizeScope,
  resolveScope,
  applyOwnerScope,
};
