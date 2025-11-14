// controllers/whoamiController.js
// Retorna informações básicas da sessão/autenticação atual.

const { getClientIp, getClientIps, normalizeAccessRestrictions } = require('../utils/ipAccess');

exports.get = (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
  }

  const user = req.session.user;
  const ip = req.clientIp || getClientIp(req);
  const ips = Array.isArray(req.clientIps) && req.clientIps.length ? req.clientIps : getClientIps(req);
  const accessEvaluation = req.accessEvaluation || {};
  const restrictions = normalizeAccessRestrictions(user.access_restrictions || {});
  const fallbackScope = restrictions.ip.enabled
    ? 'ip_restricted'
    : restrictions.schedule.enabled
      ? 'schedule_restricted'
      : 'unrestricted';
  const scope = accessEvaluation.scope || fallbackScope;

  return res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      ip,
      ips,
      userAgent: req.headers['user-agent'] || null,
      accessScope: scope,
      restrictions,
    },
  });
};
