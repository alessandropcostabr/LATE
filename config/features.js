// config/features.js
// Flags de recursos — habilitam/desabilitam funcionalidades sem alterar código.

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return defaultValue;
}

// Feature flags removidas:
// - detectRelatedMessages: Funcionalidade de registros relacionados está sempre ativa

module.exports = {
  // Adicione novas feature flags aqui quando necessário
};
