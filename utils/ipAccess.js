// utils/ipAccess.js
// Helpers para política de acesso por IP (allowlist/blocklist + exceções por usuário).

const ipaddr = require('ipaddr.js');

function normalizeIp(value) {
  if (!value) return '0.0.0.0';
  const trimmed = String(value).trim();
  if (!trimmed) return '0.0.0.0';
  // Remove prefix IPv6 mapped (::ffff:)
  if (trimmed.includes('::ffff:')) {
    const ipv4 = trimmed.split('::ffff:').pop();
    if (ipv4) return ipv4;
  }
  return trimmed;
}

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseCidr(entry) {
  const trimmed = normalizeIp(entry);
  if (!trimmed) return null;
  const [addrStr, prefixStr] = trimmed.includes('/') ? trimmed.split('/') : [trimmed, null];
  try {
    const addr = ipaddr.parse(addrStr);
    const kind = addr.kind();
    const maxPrefix = kind === 'ipv6' ? 128 : 32;
    const prefix = prefixStr ? Number(prefixStr) : maxPrefix;
    if (!Number.isFinite(prefix) || prefix < 0 || prefix > maxPrefix) return null;
    return { addr, kind, prefix, raw: trimmed };
  } catch (err) {
    return null;
  }
}

function buildCidrList(rawList) {
  return splitCsv(rawList)
    .map(parseCidr)
    .filter(Boolean);
}

function ipMatchesList(ip, cidrList) {
  if (!cidrList.length) return false;
  let parsedIp;
  try {
    parsedIp = ipaddr.parse(ip);
  } catch (err) {
    return false;
  }
  return cidrList.some(({ addr, kind, prefix }) => {
    try {
      if (parsedIp.kind() !== kind) return false;
      return parsedIp.match(addr, prefix);
    } catch (err) {
      return false;
    }
  });
}

const policyCache = {
  signature: null,
  data: {
    allowCidrs: [],
    blockCidrs: [],
    offsitePolicy: 'deny',
  },
};

function loadPolicy() {
  const signature = [
    process.env.IP_ALLOWLIST || '',
    process.env.IP_BLOCKLIST || '',
    process.env.OFFSITE_POLICY || '',
  ].join('|');

  if (policyCache.signature === signature) {
    return policyCache.data;
  }

  const allowCidrs = buildCidrList(process.env.IP_ALLOWLIST);
  const blockCidrs = buildCidrList(process.env.IP_BLOCKLIST);
  const rawPolicy = String(process.env.OFFSITE_POLICY || 'deny').trim().toLowerCase();
  const offsitePolicy = rawPolicy === 'allow' ? 'allow' : 'deny';

  policyCache.signature = signature;
  policyCache.data = { allowCidrs, blockCidrs, offsitePolicy };
  return policyCache.data;
}

function resolveScope({ isOfficeIp, allowOffsiteAccess }) {
  if (isOfficeIp) return 'internal';
  return allowOffsiteAccess ? 'external_allowed' : 'external_blocked';
}

function evaluateAccess({ ip, allowOffsiteAccess }) {
  const normalizedIp = normalizeIp(ip);
  const policy = loadPolicy();
  const hasAllowlist = policy.allowCidrs.length > 0;
  const isOfficeIp = hasAllowlist ? ipMatchesList(normalizedIp, policy.allowCidrs) : true;
  const allowedByAllowlist = hasAllowlist ? isOfficeIp : true;
  const blockedByBlocklist = policy.blockCidrs.length ? ipMatchesList(normalizedIp, policy.blockCidrs) : false;
  const enforceAllowlist = policy.offsitePolicy !== 'allow';

  const result = {
    allowed: true,
    reason: null,
    message: null,
    ip: normalizedIp,
    isOfficeIp,
    scope: resolveScope({ isOfficeIp, allowOffsiteAccess: Boolean(allowOffsiteAccess) }),
  };

  if (blockedByBlocklist) {
    return {
      ...result,
      allowed: false,
      reason: 'blocklist',
      message: 'Acesso bloqueado pelo IP (política de segurança).',
    };
  }

  if (policy.offsitePolicy === 'deny' && !isOfficeIp && !allowOffsiteAccess) {
    return {
      ...result,
      allowed: false,
      reason: 'offsite_policy',
      message: 'Acesso externo negado. Contate o administrador.',
    };
  }

  if (!allowedByAllowlist && enforceAllowlist && !allowOffsiteAccess) {
    return {
      ...result,
      allowed: false,
      reason: 'allowlist',
      message: 'IP não autorizado pela lista de acesso.',
    };
  }

  return result;
}

function getClientIps(req) {
  if (Array.isArray(req.ips) && req.ips.length) {
    return req.ips.map(normalizeIp);
  }

  const fallbackIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || req.connection?.socket?.remoteAddress;
  if (fallbackIp) {
    return [normalizeIp(fallbackIp)];
  }

  return [];
}

function getClientIp(req) {
  if (req.clientIp) return normalizeIp(req.clientIp);
  if (Array.isArray(req.ips) && req.ips.length) {
    return normalizeIp(req.ips[0]);
  }
  if (req.ip) return normalizeIp(req.ip);
  const fallbackIp = req.connection?.remoteAddress || req.socket?.remoteAddress || req.connection?.socket?.remoteAddress;
  if (fallbackIp) return normalizeIp(fallbackIp);
  return '0.0.0.0';
}


module.exports = {
  evaluateAccess,
  getClientIp,
  getClientIps,
  resolveScope,
  normalizeIp,
};
