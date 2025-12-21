const db = require('../config/database');
const MessageAlert = require('../models/messageAlert');
const UserModel = require('../models/user');

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

describe('MessageAlert batch helpers', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('getLastAlertsByType retorna map por message_id', async () => {
    db.query.mockResolvedValue({
      rows: [
        { message_id: 'm1', last_sent: '2025-12-20T10:00:00Z' },
        { message_id: 'm2', last_sent: '2025-12-20T11:00:00Z' },
      ],
    });

    const result = await MessageAlert.getLastAlertsByType(['m1', 'm2'], 'pending');
    expect(result).toEqual({
      m1: '2025-12-20T10:00:00Z',
      m2: '2025-12-20T11:00:00Z',
    });
    expect(db.query).toHaveBeenCalled();
  });

  test('getLastAlertsByType retorna vazio para lista vazia', async () => {
    const result = await MessageAlert.getLastAlertsByType([], 'pending');
    expect(result).toEqual({});
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('UserModel batch helpers', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('getActiveUsersBySectors agrupa por setor', async () => {
    db.query.mockResolvedValue({
      rows: [
        { sector_id: 's1', id: 1, name: 'Ana', email: 'ana@example.com' },
        { sector_id: 's1', id: 2, name: 'Bruno', email: 'bruno@example.com' },
        { sector_id: 's2', id: 3, name: 'Carla', email: 'carla@example.com' },
      ],
    });

    const result = await UserModel.getActiveUsersBySectors(['s1', 's2']);
    expect(result).toEqual({
      s1: [
        { id: 1, name: 'Ana', email: 'ana@example.com' },
        { id: 2, name: 'Bruno', email: 'bruno@example.com' },
      ],
      s2: [
        { id: 3, name: 'Carla', email: 'carla@example.com' },
      ],
    });
    expect(db.query).toHaveBeenCalled();
  });

  test('getUsersByIds retorna mapa por id', async () => {
    db.query.mockResolvedValue({
      rows: [
        { id: 1, name: 'Ana', email: 'ana@example.com' },
        { id: 2, name: 'Bruno', email: 'bruno@example.com' },
      ],
    });

    const result = await UserModel.getUsersByIds([1, 2]);
    expect(result).toEqual({
      1: { id: 1, name: 'Ana', email: 'ana@example.com' },
      2: { id: 2, name: 'Bruno', email: 'bruno@example.com' },
    });
    expect(db.query).toHaveBeenCalled();
  });

  test('getUsersByIds retorna vazio para lista vazia', async () => {
    const result = await UserModel.getUsersByIds([]);
    expect(result).toEqual({});
    expect(db.query).not.toHaveBeenCalled();
  });
});
