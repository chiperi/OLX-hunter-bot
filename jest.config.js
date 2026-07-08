/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['reflect-metadata'],
  setupFilesAfterEnv: ['<rootDir>/test/jest-setup.ts'],
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/persistence/redis.provider.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { statements: 80, lines: 80, functions: 80, branches: 70 },
  },
};
