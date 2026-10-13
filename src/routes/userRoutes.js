import { UserController } from '../modules/user/controller.js';

export default async function userRoutes(fastify, { userService, checkUser }) {
  const controller = new UserController({ userService });

  fastify.post('/auth/register', controller.register);
  fastify.post('/auth/login', controller.login);
  fastify.post('/auth/logout', { onRequest: [checkUser] }, controller.logout);
}
