// middleware/scope.js
// Valida escopo de listagem (me|team|all) e normaliza no req.scopeResoled.

const { resolveScope, normalizeScope } = require('../utils/scope');

function validateScopeParam() {
  return (req, res, next) => {
    const raw = req.query.scope;
    if (raw && !['me', 'team', 'all'].includes(String(raw).toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Parâmetro scope inválido (me|team|all)' });
    }
    req.scopeResolved = resolveScope(raw, req.session?.user || {});
    next();
  };
}

module.exports = {
  validateScopeParam,
};
