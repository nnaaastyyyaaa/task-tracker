import { app } from '../src/app.js';

const fastify = app();

fastify.listen(
  { port: Number(process.env.PORT) || 3000, host: process.env.HOST || '127.0.0.1' },
  function (err, address) {
    if (err) {
      fastify.log.error(err);
    }
    fastify.log.info(`Server listening at ${address}`);
  },
);
