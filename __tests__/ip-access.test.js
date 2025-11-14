const { evaluateAccess } = require('../utils/ipAccess');

describe('ipAccess evaluateAccess', () => {
  const originalAllowlist = process.env.IP_ALLOWLIST;
  const originalBlocklist = process.env.IP_BLOCKLIST;
  const originalPolicy = process.env.OFFSITE_POLICY;

  afterEach(() => {
    process.env.IP_ALLOWLIST = originalAllowlist;
    process.env.IP_BLOCKLIST = originalBlocklist;
    process.env.OFFSITE_POLICY = originalPolicy;
  });

  it('permite acesso quando não há allowlist configurada', () => {
    delete process.env.IP_ALLOWLIST;
    delete process.env.IP_BLOCKLIST;
    process.env.OFFSITE_POLICY = 'deny';

    const result = evaluateAccess({ ip: '8.8.8.8', allowOffsiteAccess: false });
    expect(result.allowed).toBe(true);
    expect(result.scope).toBe('internal');
  });

  it('bloqueia IP externo quando política OFFSITE=deny e usuário não possui exceção', () => {
    process.env.IP_ALLOWLIST = '10.0.0.0/8';
    delete process.env.IP_BLOCKLIST;
    process.env.OFFSITE_POLICY = 'deny';

    const result = evaluateAccess({ ip: '200.200.200.200', allowOffsiteAccess: false });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('offsite_policy');
  });
});
