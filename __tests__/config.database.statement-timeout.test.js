class FakePool {
  constructor(client) {
    this.client = client;
  }

  on(event, handler) {
    if (event === 'connect' && typeof handler === 'function') {
      handler(this.client);
    }
    return this;
  }

  query() {
    return Promise.resolve();
  }

  connect() {
    return Promise.resolve({
      query: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    });
  }

  end() {
    return Promise.resolve();
  }
}

describe('config/database statement_timeout', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    if (global.__LATE_POOL_FACTORY) {
      delete global.__LATE_POOL_FACTORY;
    }
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  it('aplica statement_timeout padrão de 60000ms em produção', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PG_STATEMENT_TIMEOUT_MS;
    delete process.env.STATEMENT_TIMEOUT_MS;

    const client = { query: jest.fn().mockResolvedValue(undefined) };
    global.__LATE_POOL_FACTORY = () => new FakePool(client);

    const pool = require('../config/database');
    expect(client.query).toHaveBeenCalledWith('SET statement_timeout TO 60000');
    expect(pool.statementTimeoutMs).toBe(60000);
  });

  it('não aplica statement_timeout quando configurado explicitamente para 0', () => {
    process.env.NODE_ENV = 'production';
    process.env.PG_STATEMENT_TIMEOUT_MS = '0';

    const client = { query: jest.fn().mockResolvedValue(undefined) };
    global.__LATE_POOL_FACTORY = () => new FakePool(client);

    const pool = require('../config/database');
    expect(client.query).not.toHaveBeenCalled();
    expect(pool.statementTimeoutMs).toBe(0);
  });

  it('usa fallback seguro quando valor inválido é fornecido', () => {
    process.env.NODE_ENV = 'production';
    process.env.PG_STATEMENT_TIMEOUT_MS = '-5';

    const client = { query: jest.fn().mockResolvedValue(undefined) };
    global.__LATE_POOL_FACTORY = () => new FakePool(client);

    const pool = require('../config/database');
    expect(client.query).toHaveBeenCalledWith('SET statement_timeout TO 60000');
    expect(pool.statementTimeoutMs).toBe(60000);
  });
});
