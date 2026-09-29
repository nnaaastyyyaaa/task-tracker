import Fastify from 'fastify';

export function app() {
  const fastify = Fastify({
    logger: true,
  });

  fastify.get('/health', function (request, res) {
    res.send({ status: 'OK' });
  });

  return fastify;
}
