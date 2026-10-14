import { parseId } from '../../utils/parseId.js';

export class ProjectController {
  constructor({ projectService }) {
    this.projectService = projectService;
  }

  sendResponse = (reply, data, status = 200) => {
    reply.code(status).send({ data });
  };

  create = async (request, reply) => {
    const project = await this.projectService.create({
      user: request.user,
      ...request.body,
    });
    return this.sendResponse(reply, project, 201);
  };

  list = async (request) => this.projectService.list(request.user);

  getOne = async (request) =>
    this.projectService.getById(request.user, parseId(request.params.projectId));
}
