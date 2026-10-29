import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(() => {
  const env = loadEnv('test', process.cwd(), '');

  return {
    test: {
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        include: ['src/modules/**/*.js', 'src/utils/*.js'],
        thresholds: {
          'src/modules/task/**': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
          },
        },
      },
    },
  };
});
