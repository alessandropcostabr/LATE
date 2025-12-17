// __tests__/setup/log-silence.js
// Silencia logs ruidosos (dotenv/db) durante os testes.

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  if (console.log.mockRestore) console.log.mockRestore();
  if (console.info.mockRestore) console.info.mockRestore();
  if (console.warn.mockRestore) console.warn.mockRestore();
  if (console.error.mockRestore) console.error.mockRestore();
});
