const express = require('express');
const supertest = require('supertest');

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const db = require('../config/database');
const healthController = require('../controllers/healthController');

describe('GET /health', () => {
  it('retorna 200 e executa SELECT 1', async () => {
    const queryMock = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    db.query.mockImplementation(queryMock);

    const app = express();
    app.get('/health', healthController.check);

    const response = await supertest(app).get('/health');

    expect(queryMock).toHaveBeenCalledWith('SELECT 1');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });
});
