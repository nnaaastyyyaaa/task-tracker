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
      Number(request.params.projectId),
      request.query.assignee,
    );
    this.sendResponse(reply, tasks, 200);
  };

  create = async (request, reply) => {
    const task = await this.taskService.create({
      currentUser: request.user,
      projectId: Number(request.params.projectId),
      ...request.body,
    });
    this.sendResponse(reply, task, 201);
  };

  getOne = async (request, reply) => {
    const task = await this.taskService.getById(
      request.user,
      Number(request.params.taskId),
    );
    this.sendResponse(reply, task, 200);
  };

  update = async (request, reply) => {
    const updated = await this.taskService.update({
      user: request.user,
      taskId: Number(request.params.taskId),
      ...request.body,
    });
    this.sendResponse(reply, updated, 200);
  };

  changeStatus = async (request, reply) => {
    const updated = await this.taskService.changeStatus(
      request.user,
      Number(request.params.taskId),
      request.body.status,
    );
    this.sendResponse(reply, updated, 200);
  };

  changeAssignee = async (request, reply) => {
    const updated = await this.taskService.changeAssignee(
      request.user,
      Number(request.params.taskId),
      request.body.assigneeId,
    );
    this.sendResponse(reply, updated, 200);
  };

  remove = async (request, reply) => {
    await this.taskService.remove(request.user, Number(request.params.taskId));
    this.sendResponse(reply, { message: 'deleted' }, 204);
  };
}
