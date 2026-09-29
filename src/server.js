import { app } from '../src/app.js';

const fastify = app();

fastify.listen({ port: 3000 }, function (err, address) {
  if (err) {
    fastify.log.error(err);
  }
  fastify.log.info(`Server listening at ${address}`);
});
