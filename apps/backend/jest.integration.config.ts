import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/integration/**/*.test.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  globalSetup:    './src/__tests__/integration/globalSetup.js',
  globalTeardown: './src/__tests__/integration/globalTeardown.js',
  setupFiles:     ['./src/__tests__/integration/envSetup.ts'],
  testTimeout: 30000,  // DB ops + migrations can take time on first run
};

export default config;
