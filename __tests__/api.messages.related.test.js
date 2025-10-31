jest.mock('../models/message', () => ({
  listRelatedMessages: jest.fn(),
}));

jest.mock('../models/contact', () => ({
  updateFromMessage: jest.fn(),
}));

jest.mock('../config/features', () => ({
  detectRelatedMessages: true,
}));

jest.mock('../controllers/helpers/viewer', () => ({
  resolveViewerWithSectors: jest.fn(async (req) => ({
    id: req.session?.user?.id ?? null,
    sectorIds: [],
  })),
  getViewerFromRequest: jest.fn(() => ({ id: 0 })),
}));

const messageModel = require('../models/message');
const features = require('../config/features');
const { handleValidationErrors, validateRelatedMessagesQuery } = require('../middleware/validation');
const messageController = require('../controllers/messageController');

function createMockReq({ phone, email, limit, exclude, role = 'reader' } = {}) {
  return {
    method: 'GET',
    path: '/api/messages/related',
    query: {
      phone,
      email,
      limit,
      exclude,
    },
    session: {
      user: {
        id: 101,
        name: 'Usuário Teste',
        role,
      },
    },
    get: () => null,
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    _ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this._ended = true;
      return this;
    },
  };
}

function runMiddleware(mw, req, res) {
  return new Promise((resolve, reject) => {
    const next = (err) => (err ? reject(err) : resolve());
    try {
      const result = mw(req, res, next);
      if (res._ended) {
        resolve();
        return;
      }
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject);
      } else if (mw.length < 3) {
        resolve();
      }
    } catch (err) {
      reject(err);
    }
  });
}

async function runValidation(req, res) {
  for (const mw of validateRelatedMessagesQuery) {
    await runMiddleware(mw, req, res);
    if (res._ended) return;
  }
  await runMiddleware(handleValidationErrors, req, res);
}

describe('GET /api/messages/related', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    features.detectRelatedMessages = true;
  });

  it('retorna a lista de registros relacionados quando feature está ativa', async () => {
    messageModel.listRelatedMessages.mockResolvedValueOnce([
      {
        id: 10,
        call_date: '2025-02-01',
        subject: 'Registro teste',
        status: 'pending',
        recipient: 'Fulano',
        parent_message_id: null,
        created_at: '2025-02-01T10:00:00Z',
      },
    ]);

    const req = createMockReq({
      phone: ' (11) 98888-0000 ',
      limit: '3',
      exclude: '42',
    });
    const res = createMockRes();

    await runValidation(req, res);
    expect(res._ended).toBe(false);

    await messageController.listRelated(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: [
        expect.objectContaining({
          id: 10,
          call_date: '2025-02-01',
          subject: 'Registro teste',
          status: 'pending',
          status_label: 'Pendente',
          recipient_name: 'Fulano',
        }),
      ],
    });

    expect(messageModel.listRelatedMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        phone: '(11) 98888-0000',
        email: '',
        limit: 3,
        excludeId: 42,
        viewer: expect.objectContaining({ id: 101 }),
      }),
    );
  });

  it('retorna 400 quando nenhum identificador é informado', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await runValidation(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Dados inválidos',
    });
    expect(messageModel.listRelatedMessages).not.toHaveBeenCalled();
  });

  it('retorna 404 quando a feature está desativada', async () => {
    features.detectRelatedMessages = false;
    const req = createMockReq({ email: 'teste@late.dev' });
    const res = createMockRes();

    await runValidation(req, res);
    expect(res._ended).toBe(false);

    await messageController.listRelated(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Recurso indisponível',
    });
    expect(messageModel.listRelatedMessages).not.toHaveBeenCalled();
  });
});
