// controllers/whoamiController.js
// Retorna informações básicas da sessão/autenticação atual.

const { getClientIp, getClientIps, resolveScope } = require('../utils/ipAccess');

exports.get = (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
  }

  const user = req.session.user;
  const ip = req.clientIp || getClientIp(req);
  const ips = Array.isArray(req.clientIps) && req.clientIps.length ? req.clientIps : getClientIps(req);
  const allowOffsite = Boolean(user.allow_offsite_access);
  const scope = req.accessScope || resolveScope({
    isOfficeIp: Boolean(req.isOfficeIp),
    allowOffsiteAccess: allowOffsite,
  });

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
      allow_offsite_access: allowOffsite,
      policy: {
        offsite: (process.env.OFFSITE_POLICY || 'deny').toLowerCase(),
      },
    },
  });
};
