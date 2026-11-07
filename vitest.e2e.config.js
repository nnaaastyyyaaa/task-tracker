import { defineConfig, loadEnv } from 'vite';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.js'],
    globalSetup: ['tests/integration/globalSetup.js'],
    env: loadEnv('test', process.cwd(), ''),
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
