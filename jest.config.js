module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testMatch: ['**/*.test.(ts|js)'],
  testEnvironment: 'node',
  // added for jest to look for the dependencies
  modulePaths: ['src/']
};
