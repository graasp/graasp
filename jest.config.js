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
  // added for jest to look for the dependencies
  modulePaths: ['src/'],
  cacheDirectory: '.jest-cache',
};
