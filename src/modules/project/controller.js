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
    this.projectService.getById(request.user, Number(request.params.projectId));

  addMember = async (request, reply) => {
    const members = await this.projectService.addMember({
      currentUser: request.user,
      projectId: Number(request.params.projectId),
      email: request.body?.email,
    });
    return reply.code(201).send(members);
  };
}
