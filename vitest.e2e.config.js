import { defineConfig, loadEnv } from 'vite';

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.js'],
    // Той самий globalSetup, що й в інтеграційних тестів: перевіряє, що БД закінчується на _test,
    // і застосовує міграції. Підправте шлях, якщо файл лежить в іншому місці.
    globalSetup: ['tests/integration/globalSetup.js'],
    // Змінні з .env.test потрапляють у воркери, щоб src/db/prisma.js підключився до тестової БД.
    env: loadEnv('test', process.cwd(), ''),
    // Усі файли ділять одну БД, тому запускаються по черзі.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
