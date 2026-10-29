import { app } from '../../../src/app.js';

export async function buildTestApp() {
  const fastify = app({ logger: false });
  await fastify.ready();
  return fastify;
}
