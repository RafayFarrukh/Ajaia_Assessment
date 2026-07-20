import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://ajaia:ajaia@localhost:5433/ajaia_docs_test';

// Bring the dedicated test database up to the current schema (non-destructive;
// per-run data cleanup happens in the test suite's beforeAll).
export default function setup(): void {
  execSync('npx prisma migrate deploy', {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
