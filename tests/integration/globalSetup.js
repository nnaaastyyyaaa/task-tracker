import { execSync } from 'node:child_process';
import { loadEnv } from 'vite';

export default function setup() {
  const env = loadEnv('test', process.cwd(), '');
  const url = env.DATABASE_URL ?? '';

  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run integration tests on database "${dbName}"`);
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}
