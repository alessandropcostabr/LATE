const registeredRoutes = [];

jest.mock('router', () => {
  return function Router() {
    const register = (method) =>
      jest.fn((path, ...handlers) => {
        registeredRoutes.push({ method, path, handlers });
      });

    return {
      get: register('get'),
      post: register('post'),
      put: register('put'),
      patch: register('patch'),
      delete: register('delete')
    };
  };
});

jest.mock('../controllers/messageController', () => {
  const dispatchBackground = jest.fn((_task, fn) => {
    if (typeof fn === 'function') {
      try {
        const result = fn();
        return result && typeof result.then === 'function' ? result : Promise.resolve(result);
      } catch (err) {
        return Promise.reject(err);
      }
    }
    return Promise.resolve();
  });
  return {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
    __internals: {
      sanitizePayload: jest.fn((payload) => ({ ...payload })),
      extractRecipientInput: jest.fn((body) => ({ ...body })),
      resolveRecipientTarget: jest.fn(async (input = {}) => ({
        recipient: input.recipient || null,
        recipient_user_id: input.recipientUserId ?? input.recipient_user_id ?? null,
        recipient_sector_id: input.recipientSectorId ?? input.recipient_sector_id ?? null,
        error: null,
      })),
      notifyRecipientUser: jest.fn(),
      notifyRecipientSectorMembers: jest.fn(),
      logMessageEvent: jest.fn(),
      dispatchBackground,
      attachCreatorNames: jest.fn(async (rows) => rows),
    },
  };
});

jest.mock('../controllers/statsController', () => ({}));

jest.mock('../middleware/validation', () => ({
  handleValidationErrors: jest.fn((req, res, next) => next && next()),
  handleIntakeValidationErrors: jest.fn((req, res, next) => next && next()),
  validateCreateMessage: jest.fn(),
  validateUpdateMessage: jest.fn(),
  validateUpdateStatus: jest.fn(),
  validateId: jest.fn(),
  validateQueryMessages: jest.fn()
}));

describe('routes/api defensive middleware fallback', () => {
  let warnSpy;

  beforeEach(() => {
    registeredRoutes.length = 0;
    jest.resetModules();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('registers warning middleware when controller export is missing', () => {
    expect(() => {
      jest.isolateModules(() => {
        require('../routes/api');
      });
    }).not.toThrow();

    const statsRoute = registeredRoutes.find(
      (route) => route.method === 'get' && route.path === '/messages/stats'
    );

    expect(statsRoute).toBeDefined();
    expect(statsRoute.handlers.length).toBeGreaterThanOrEqual(1);

    const req = {
      session: { user: { role: 'ADMIN' } },
      originalUrl: '/api/messages/stats',
    };
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    res.redirect = jest.fn();
    res.render = jest.fn();
    const next = jest.fn();

    warnSpy.mockClear();
    statsRoute.handlers.forEach((handler) => handler(req, res, next));

    expect(next).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });
});
