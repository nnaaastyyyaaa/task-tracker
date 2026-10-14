import { AppError } from '../../utils/errorHandler.js';
const MEMBER_ROLES = ['owner', 'member'];

const forbidden = (message = 'Access denied') => new AppError(403, 'FORBIDDEN', message);

export class ProjectMemberService {
  constructor({ projectMemberRepository, userService }) {
    this.projectMemberRepository = projectMemberRepository;
    this.userService = userService;
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

  async addMember({ currentUser, projectId, email }) {
    const role = await this.getRole(projectId, currentUser.id);
    if (role !== 'owner') throw forbidden('Only the project owner can add members');

    if (typeof email !== 'string' || email.trim() === '') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email required');
    }

    const user = await this.userService.findByEmail(email);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    await this.add({ projectId, userId: user.id, role: 'member' });
    return this.list(projectId);
  }
}
