const { resolveSessionSecret, DEFAULT_SECRET } = require('../config/sessionSecret');

describe('resolveSessionSecret', () => {
  const originalEnv = process.env.SESSION_SECRET;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SESSION_SECRET;
    } else {
      process.env.SESSION_SECRET = originalEnv;
    }
  });

  it('lança erro em produção quando SESSION_SECRET está ausente', () => {
    delete process.env.SESSION_SECRET;
    expect(() => resolveSessionSecret({ isProd: true })).toThrow('SESSION_SECRET ausente em produção');
  });

  it('lança erro em produção quando SESSION_SECRET usa o valor padrão', () => {
    process.env.SESSION_SECRET = DEFAULT_SECRET;
    expect(() => resolveSessionSecret({ isProd: true })).toThrow('SESSION_SECRET não pode usar o valor padrão em produção');
  });

  it('retorna o valor configurado fora de produção', () => {
    process.env.SESSION_SECRET = 'custom-secret';
    expect(resolveSessionSecret({ isProd: false })).toBe('custom-secret');
  });

  it('retorna o padrão fora de produção quando ausente', () => {
    delete process.env.SESSION_SECRET;
    expect(resolveSessionSecret({ isProd: false })).toBe(DEFAULT_SECRET);
  });
});
