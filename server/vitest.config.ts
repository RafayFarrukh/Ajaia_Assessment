import { defineConfig } from 'vitest/config';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://ajaia:ajaia@localhost:5433/ajaia_docs_test';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      REVISION_THROTTLE_MS: '0', // deterministic: every content save snapshots
    },
    globalSetup: './test/global-setup.ts',
    // One DB → run test files serially to avoid cross-file interference.
    fileParallelism: false,
  },
});
