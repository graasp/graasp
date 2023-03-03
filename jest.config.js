module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }]
  },
  testMatch: ['**/*.test.(ts|js)'],
  testEnvironment: 'node',
  // added for jest to look for the dependencies
  modulePaths: ['src/'],
};
