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

const detectRelatedMessages = parseBoolean(process.env.FEATURE_DETECT_RELATED_MESSAGES, true);

module.exports = {
  detectRelatedMessages,
};
