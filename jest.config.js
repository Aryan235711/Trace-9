export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  roots: ['<rootDir>/server', '<rootDir>/shared', '<rootDir>/client'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/src/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  collectCoverageFrom: [
    'server/**/*.ts',
    'shared/**/*.ts',
    '!**/*.test.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
};
