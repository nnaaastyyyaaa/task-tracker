import { parseId } from '../../utils/parseId.js';

export class TaskController {
  constructor({ taskService }) {
    this.taskService = taskService;
  }

  sendResponse = (reply, data, status = 200) => {
    reply.code(status).send({ data });
  };

  listByProject = async (request, reply) => {
    const tasks = await this.taskService.listByProject(
      request.user,
      parseId(request.params.projectId),
      request.query.assignee,
    );
    this.sendResponse(reply, tasks, 200);
  };

  create = async (request, reply) => {
    const task = await this.taskService.create(
      request.user,
      parseId(request.params.projectId),
      request.body,
    );
    this.sendResponse(reply, task, 201);
  };

  getOne = async (request, reply) => {
    const task = await this.taskService.getById(
      request.user,
      parseId(request.params.taskId),
    );
    this.sendResponse(reply, task, 200);
  };

  update = async (request, reply) => {
    const updated = await this.taskService.update(
      request.user,
      parseId(request.params.taskId),
      request.body,
    );
    this.sendResponse(reply, updated, 200);
  };

  changeStatus = async (request, reply) => {
    const updated = await this.taskService.changeStatus(
      request.user,
      parseId(request.params.taskId),
      request.body,
    );
    this.sendResponse(reply, updated, 200);
  };

  changeAssignee = async (request, reply) => {
    const updated = await this.taskService.changeAssignee(
      request.user,
      parseId(request.params.taskId),
      request.body,
    );
    this.sendResponse(reply, updated, 200);
  };

  remove = async (request, reply) => {
    await this.taskService.remove(request.user, parseId(request.params.taskId));

    return reply.code(204).send();
  };
}
