module.exports = {
  // Se só JS, use preset 'default'; para TS, use 'ts-jest'
  preset: 'undefined',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
  collectCoverage: true,
  coverageDirectory: 'coverage'
};
