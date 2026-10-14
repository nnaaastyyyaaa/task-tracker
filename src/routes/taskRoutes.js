import { TaskController } from '../modules/task/controller.js';

export default async function taskRoutes(fastify, { taskService, checkUser }) {
  const controller = new TaskController({ taskService });
  const auth = { onRequest: [checkUser] };

  fastify.get('/projects/:projectId/tasks', auth, controller.listByProject);
  fastify.post('/projects/:projectId/tasks', auth, controller.create);
  fastify.get('/tasks/:taskId', auth, controller.getOne);
  fastify.patch('/tasks/:taskId', auth, controller.update);
  fastify.patch('/tasks/:taskId/status', auth, controller.changeStatus);
  fastify.patch('/tasks/:taskId/assignee', auth, controller.changeAssignee);
  fastify.delete('/tasks/:taskId', auth, controller.remove);
}
