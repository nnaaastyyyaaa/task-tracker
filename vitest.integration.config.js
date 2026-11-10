import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.js'],
    env: loadEnv('test', process.cwd(), ''),
    globalSetup: ['tests/integration/globalSetup.js'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
