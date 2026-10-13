import Fastify from 'fastify';
import 'dotenv/config';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

import { CustomHandler } from './utils/errorHandler.js';
import { userService, checkUser } from './container/user.js';
import userRoutes from './routes/userRoutes.js';

export function app() {
  const fastify = Fastify({
    logger: true,
  });

  CustomHandler(fastify);
  fastify.register(cookie);
  fastify.register(cors, {
    // origin: 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  fastify.get('/health', function (request, reply) {
    reply.send({ status: 'OK' });
  });
  fastify.register(userRoutes, { userService, checkUser });

  return fastify;
}
