/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: require.resolve('detox/runners/jest/testEnvironment'),
  testRunner: 'jest-circus/runner',
  testMatch: ['**/?(*.)+(e2e).[jt]s?(x)'],
  setupFilesAfterEnv: ['<rootDir>/init.e2e.ts'],
  reporters: [require.resolve('detox/runners/jest/reporter')],
  verbose: true,
  testTimeout: 120000,
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../tsconfig.json',
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  maxWorkers: 1,
};
