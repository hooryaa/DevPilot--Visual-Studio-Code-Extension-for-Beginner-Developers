module.exports = {
  // Use ts-jest as a transformer directly to avoid preset resolution issues
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest/dist/index.js', { tsconfig: 'tsconfig.json' }]
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/test/mocks/vscodeMock.ts'
  },
};