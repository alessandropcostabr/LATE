const crypto = require('crypto');
const telephonyController = require('../controllers/telephonyController');

// Mock model
jest.mock('../models/telephonyEventModel', () => ({
  insertEvent: jest.fn(async () => ({ persisted: true, id: 1 })),
}));

function makeReq(body = {}, headers = {}, ip = '127.0.0.1') {
  return {
    body,
    headers,
    ip,
    rawBody: JSON.stringify(body),
  };
}

function makeRes() {
  return {
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    status(code) { this.statusCode = code; return this; },
  };
}

describe('telephonyController.verifyHmac hardening', () => {
  const bearer = 'token';
  const secret = 'hmac-secret';
  const envBackup = { ...process.env };

  beforeAll(() => {
    process.env.TELEPHONY_BEARER = bearer;
    process.env.TELEPHONY_HMAC_SECRET = secret;
    process.env.TELEPHONY_ALLOWLIST = '127.0.0.1';
  });

  afterAll(() => {
    process.env = envBackup;
  });

  test('assinatura com tamanho diferente retorna 401 INVALID_SIGNATURE sem 500', async () => {
    const body = { uniqueid: '1', event: 'TEST', start_ts: Date.now() };
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('base64');
    const req = makeReq(body, {
      authorization: `Bearer ${bearer}`,
      'x-signature': signature.slice(0, -2), // tamanho diferente
    });
    const res = makeRes();

    await telephonyController.ingest(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect(res.body.success).toBe(false);
  });
});
