// utils/ipAccess.js
// Helpers para política de acesso por IP, horários e identificação do cliente.

const ipaddr = require('ipaddr.js');

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

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

const blocklistCache = {
  signature: null,
  cidrs: [],
};

function loadBlocklist() {
  const signature = process.env.IP_BLOCKLIST || '';
  if (blocklistCache.signature === signature) {
    return blocklistCache.cidrs;
  }
  const cidrs = buildCidrList(signature);
  blocklistCache.signature = signature;
  blocklistCache.cidrs = cidrs;
  return cidrs;
}

function normalizeTime(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : null;
}

function normalizeAccessRestrictions(raw) {
  const base = { ip: { enabled: false, allowed: [] }, schedule: { enabled: false, ranges: [] } };
  if (!raw || typeof raw !== 'object') return base;

  const ipConfig = raw.ip && typeof raw.ip === 'object' ? raw.ip : {};
  const allowedIps = Array.isArray(ipConfig.allowed) ? ipConfig.allowed : [];
  const normalizedIps = Array.from(
    new Set(
      allowedIps
        .map((entry) => normalizeIp(entry))
        .filter((entry) => entry.length > 0)
    )
  );
  base.ip = {
    enabled: Boolean(ipConfig.enabled) && normalizedIps.length > 0,
    allowed: normalizedIps,
  };

  const scheduleConfig = raw.schedule && typeof raw.schedule === 'object' ? raw.schedule : {};
  const ranges = Array.isArray(scheduleConfig.ranges) ? scheduleConfig.ranges : [];
  const normalizedRanges = ranges
    .map((range) => {
      const day = String(range?.day || '').trim().toLowerCase();
      if (!DAY_KEYS.includes(day)) return null;
      const start = normalizeTime(range?.start);
      const end = normalizeTime(range?.end);
      if (!start || !end || start >= end) return null;
      return { day, start, end };
    })
    .filter(Boolean);

  base.schedule = {
    enabled: Boolean(scheduleConfig.enabled) && normalizedRanges.length > 0,
    ranges: normalizedRanges,
  };

  return base;
}

function isScheduleAllowed(schedule, date = new Date()) {
  if (!schedule?.enabled) return true;
  const dayKey = DAY_KEYS[date.getDay()];
  const currentTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return schedule.ranges.some((range) => range.day === dayKey && range.start <= currentTime && currentTime <= range.end);
}

function evaluateAccess({ ip, user, date = new Date() }) {
  const normalizedIp = normalizeIp(ip);
  const restrictions = normalizeAccessRestrictions(user?.access_restrictions || {});
  const blocklist = loadBlocklist();

  if (blocklist.length && ipMatchesList(normalizedIp, blocklist)) {
    return {
      allowed: false,
      reason: 'blocklist',
      message: 'Acesso bloqueado pelo IP (política global).',
      ip: normalizedIp,
      scope: 'blocked',
      restrictions,
    };
  }

  if (restrictions.ip.enabled && !restrictions.ip.allowed.includes(normalizedIp)) {
    return {
      allowed: false,
      reason: 'ip_not_allowed',
      message: 'Este endereço IP não está autorizado para este usuário.',
      ip: normalizedIp,
      scope: 'ip_restricted',
      restrictions,
    };
  }

  if (restrictions.schedule.enabled && !isScheduleAllowed(restrictions.schedule, date)) {
    return {
      allowed: false,
      reason: 'schedule',
      message: 'Horário de acesso não autorizado para este usuário.',
      ip: normalizedIp,
      scope: 'schedule_restricted',
      restrictions,
    };
  }

  const scope = restrictions.ip.enabled ? 'ip_restricted' : 'unrestricted';
  return {
    allowed: true,
    reason: null,
    message: null,
    ip: normalizedIp,
    scope,
    restrictions,
  };
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
  normalizeIp,
  normalizeAccessRestrictions,
  isScheduleAllowed,
};
