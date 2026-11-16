import type { Config } from 'jest';

/**
 * Unit-test configuration.
 *
 * Run:
 *   npm test          -> one CI-style run
 *   npm run test:watch -> re-run on file changes
 *   npm run test:cov  -> same as `npm test` + coverage report
 *
 * The e2e suite lives in `test/` and is intentionally excluded here,
 * because it boots the full AppModule (Postgres, Redis, SMTP).
 */
const config: Config = {
  // Use TypeScript instead of Babel, so .ts files are understood.
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',

  // Only unit tests inside src/. `test/*.e2e-spec.ts` is ignored.
  testMatch: ['<rootDir>/src/**/*.spec.ts'],

  // The app imports modules as `src/...` (tsconfig paths / baseUrl).
  // Jest does not read tsconfig paths, so we teach it the same mapping.
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^#src/(.*)$': '<rootDir>/src/$1',

    // ESM-only package: use a small CommonJS-friendly stub for unit tests.
    '^@nestjs/cache-manager$': '<rootDir>/test/mocks/nest-cache-manager.ts',
  },

  // Reset jest.fn() call history before every test.
  clearMocks: true,

  // Coverage is opt-in (npm run test:cov) to keep normal runs fast.
  collectCoverage: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.module.ts',
    '!src/**/entity/**',
    '!src/main.ts',
    '!src/seed-k6-users.ts',
  ],
};

export default config;
