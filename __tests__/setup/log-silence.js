// __tests__/setup/log-silence.js
// Silencia logs ruidosos (dotenv/db) durante os testes.

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
  if (console.log.mockRestore) console.log.mockRestore();
  if (console.info.mockRestore) console.info.mockRestore();
});
