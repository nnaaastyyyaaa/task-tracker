import { ProjectController } from './controller.js';

export default async function projectRoutes(fastify, { projectService, checkUser }) {
  const controller = new ProjectController({ projectService });
  const auth = { onRequest: [checkUser] };

  fastify.post('/projects', auth, controller.create);
  fastify.get('/projects', auth, controller.list);
  fastify.get('/projects/:projectId', auth, controller.getOne);
  fastify.post('/projects/:projectId/members', auth, controller.addMember);
}
