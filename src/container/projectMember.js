import { ProjectMemberRepository } from '../modules/projectMember/repository.js';
import { ProjectMemberService } from '../modules/projectMember/service.js';
import { prisma } from '../db/prisma.js';

const projectMemberRepository = new ProjectMemberRepository(prisma);

export const projectMemberService = new ProjectMemberService({
  projectMemberRepository,
});
