/** Jest config for the deterministic unit/component/regression suite.
 *  The live security suite is a separate node runner (see `pnpm test:security`). */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/test/styleMock.js',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Unit tests live outside src/app so Expo Router never treats them as routes.
  testMatch: ['<rootDir>/__tests__/**/*.test.@(ts|tsx)'],
  clearMocks: true,
};
