// eslint-disable-next-line @typescript-eslint/no-var-requires
const { config } = require('dotenv');
config({ path: '.env.test', override: true });

module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  testTimeout: 20000,
  testMatch: ['**/*.test.(ts|js)'],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/mockSetup.ts'],
  // globalTeardown: '<rootDir>/test/teardown.ts',
  globalSetup: '<rootDir>/test/setup.ts',
  // added for jest to look for the dependencies
  modulePaths: ['src/'],
  cacheDirectory: '.jest-cache',
};
