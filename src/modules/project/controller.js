import { parseId } from '../../utils/parseId.js';

export class ProjectController {
  constructor({ projectService }) {
    this.projectService = projectService;
  }

  sendResponse = (reply, data, status = 200) => {
    reply.code(status).send({ data });
  };

  create = async (request, reply) => {
    const project = await this.projectService.create(request.user, request.body);
    return this.sendResponse(reply, project, 201);
  };

  list = async (request, reply) => {
    const list = await this.projectService.list(request.user);
    return this.sendResponse(reply, list, 200);
  };

  getOne = async (request, reply) => {
    const project = await this.projectService.getById(
      request.user,
      parseId(request.params.projectId),
    );
    return this.sendResponse(reply, project, 200);
  };

  addMember = async (request, reply) => {
    const members = await this.projectService.addMember(
      request.user,
      parseId(request.params.projectId),
      request.body,
    );
    return this.sendResponse(reply, members, 201);
  };
}
