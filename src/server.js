import { app } from '../src/app.js';
import { userService } from './container/user.js';
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const fastify = app();

const cleanup = setInterval(() => {
  userService.cleanupSessions().catch((err) => fastify.log.error(err));
}, CLEANUP_INTERVAL_MS);
cleanup.unref();

fastify.listen(
  { port: Number(process.env.PORT) || 3000, host: process.env.HOST || '127.0.0.1' },
  function (err, address) {
    if (err) {
      fastify.log.error(err);
    }
    fastify.log.info(`Server listening at ${address}`);
  },
);
