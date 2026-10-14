export class ProjectMemberController {
  constructor({ projectMemberService }) {
    this.projectMemberService = projectMemberService;
  }

  sendResponse = (reply, data, status = 200) => {
    reply.code(status).send({ data });
  };

  addMember = async (request, reply) => {
    const members = await this.projectMemberService.addMember({
      currentUser: request.user,
      projectId: Number(request.params.projectId),
      email: request.body?.email,
    });
    return this.sendResponse(reply, members, 201);
  };
}
