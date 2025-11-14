const { evaluateAccess } = require('../utils/ipAccess');

describe('ipAccess evaluateAccess', () => {
  const originalBlocklist = process.env.IP_BLOCKLIST;
  const originalAllowlist = process.env.IP_ALLOWLIST;
  const originalOffsitePolicy = process.env.OFFSITE_POLICY;

  afterEach(() => {
    process.env.IP_BLOCKLIST = originalBlocklist;
    process.env.IP_ALLOWLIST = originalAllowlist;
    process.env.OFFSITE_POLICY = originalOffsitePolicy;
  });

  it('permite acesso quando não há restrições configuradas', () => {
    const result = evaluateAccess({ ip: '8.8.8.8', user: { access_restrictions: {} } });
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('unrestricted');
  });

  it('bloqueia IP quando usuário restringe lista e endereço não é permitido', () => {
    const user = {
      access_restrictions: {
        ip: { enabled: true, allowed: ['191.9.115.129'] },
        schedule: { enabled: false, ranges: [] },
      },
    };
    const result = evaluateAccess({ ip: '200.200.200.200', user });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('ip_not_allowed');
  });

  it('respeita IP permitido na lista do usuário', () => {
    const user = {
      access_restrictions: {
        ip: { enabled: true, allowed: ['200.200.200.200'] },
        schedule: { enabled: false, ranges: [] },
      },
    };
    const result = evaluateAccess({ ip: '200.200.200.200', user });
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('ip_restricted');
  });

  it('bloqueia quando horário atual não está permitido', () => {
    const user = {
      access_restrictions: {
        ip: { enabled: false, allowed: [] },
        schedule: {
          enabled: true,
          ranges: [{ day: 'mon', start: '08:00', end: '12:00' }],
        },
      },
    };
    const mondayAfternoon = new Date('2025-11-10T15:00:00-03:00'); // Segunda-feira
    const result = evaluateAccess({ ip: '177.170.115.118', user, date: mondayAfternoon });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('schedule');
  });

  it('bloqueia IP presente no blocklist global', () => {
    process.env.IP_BLOCKLIST = '177.170.0.0/16';
    const result = evaluateAccess({ ip: '177.170.115.118', user: { access_restrictions: {} } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('blocklist');
  });

  it('respeita OFFSITE_POLICY=deny quando IP não está na allowlist e usuário não tem exceção', () => {
    process.env.IP_ALLOWLIST = '191.9.115.0/24';
    process.env.OFFSITE_POLICY = 'deny';
    const result = evaluateAccess({ ip: '8.8.8.8', user: { allow_offsite_access: false, access_restrictions: {} } });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('offsite_policy');
  });

  it('permite acesso externo quando usuário possui exceção', () => {
    process.env.IP_ALLOWLIST = '191.9.115.0/24';
    process.env.OFFSITE_POLICY = 'deny';
    const result = evaluateAccess({
      ip: '8.8.8.8',
      user: { allow_offsite_access: true, access_restrictions: {} },
    });
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('external_allowed');
  });
});
