/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: require.resolve('detox/runners/jest/testEnvironment'),
  testRunner: 'jest-circus/runner',
  testMatch: ['**/?(*.)+(e2e).[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/init.e2e.ts'],
  reporters: ['default'],
  verbose: true,
  testTimeout: 120000,
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  testPathIgnorePatterns: [
    '<rootDir>/init.e2e.ts',
    '<rootDir>/jest.config.e2e.js',
  ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../tsconfig.json',
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  maxWorkers: 1,
};
