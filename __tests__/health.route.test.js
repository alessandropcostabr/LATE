const express = require('express');
const supertest = require('supertest');

jest.mock('../config/database', () => ({
  getDatabase: jest.fn(),
  close: jest.fn(),
}));

const dbManager = require('../config/database');
const healthController = require('../controllers/healthController');

describe('GET /health', () => {
  it('retorna 200 e executa SELECT 1', async () => {
    const execMock = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    dbManager.getDatabase.mockReturnValue({ exec: execMock });

    const app = express();
    app.get('/health', healthController.check);

    const response = await supertest(app).get('/health');

    expect(execMock).toHaveBeenCalledWith('SELECT 1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });
});
