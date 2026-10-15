import { AppError } from '../../utils/errorHandler.js';
const MEMBER_ROLES = ['owner', 'member'];

export class ProjectMemberService {
  constructor({ projectMemberRepository }) {
    this.projectMemberRepository = projectMemberRepository;
  }

  async getRole(projectId, userId) {
    const member = await this.projectMemberRepository.find(projectId, userId);
    return member ? member.role : null;
  }

  async isMember(projectId, userId) {
    return (await this.getRole(projectId, userId)) !== null;
  }

  async listProjectIdsOf(userId) {
    return this.projectMemberRepository.listProjectIdsOf(userId);
  }

  async list(projectId) {
    const members = await this.projectMemberRepository.listByProject(projectId);
    return members.map((m) => m.toPublic());
  }

  async add({ projectId, userId, role = 'member' }) {
    if (!MEMBER_ROLES.includes(role)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Member role is invalid');
    }
    const added = await this.projectMemberRepository.add(projectId, userId, role);
    if (!added) throw new AppError(409, 'ALREADY_MEMBER', 'User is already a member');
  }
}
