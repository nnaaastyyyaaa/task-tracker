import Fastify from 'fastify';
import 'dotenv/config';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';

import { CustomHandler } from './utils/errorHandler.js';
import { userService, checkUser } from './container/user.js';
import { projectService } from './container/project.js';
import { taskService } from './container/task.js';

import userRoutes from './modules/user/userRoutes.js';
import projectRoutes from './modules/project/projectRoutes.js';
import taskRoutes from './modules/task/taskRoutes.js';

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

  fastify.get('/health', () => ({ status: 'OK' }));
  fastify.register(userRoutes, { userService, checkUser });
  fastify.register(projectRoutes, { projectService, checkUser });
  fastify.register(taskRoutes, { taskService, checkUser });

  return fastify;
}
