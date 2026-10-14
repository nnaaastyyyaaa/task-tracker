import { ProjectMemberController } from './controller.js';

export default async function projectMemberRoutes(
  fastify,
  { projectMemberService, checkUser },
) {
  const controller = new ProjectMemberController({ projectMemberService });
  const auth = { onRequest: [checkUser] };

  fastify.post('/projects/:projectId/members', auth, controller.addMember);
}
