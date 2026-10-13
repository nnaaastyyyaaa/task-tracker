import { AppError } from '../../utils/errorHandler.js';
import { Project } from './entity.js';

const projectNotFound = () => new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
const forbidden = (message = 'Access denied') => new AppError(403, 'FORBIDDEN', message);

export class ProjectService {
  constructor({ projectRepository, userService }) {
    this.projectRepository = projectRepository;
    this.userService = userService;
  }

  async create({ user, name, description }) {
    if (user.role !== 'team_lead') {
      throw forbidden('Only a team lead can create projects');
    }

    const prDescription = description ? description.trim() : '';
    const prName = name ? name.trim() : '';

    const entity = new Project({
      name: prName,
      description: prDescription,
      ownerId: user.id,
    }).toEntity();
    const project = await this.projectRepository.create(entity);

    await this.projectRepository.addMember(project.id, user.id, 'owner');
    return project.toPublic();
  }

  async list(user) {
    const memberships = await this.projectRepository.listMembershipsOf(user.id);
    const projects = await this.projectRepository.findByIds(
      memberships.map((m) => m.projectId),
    );
    return projects.map((p) => p.toPublic());
  }

  async getById(user, projectId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw projectNotFound();

    const { role } = await this.getAccess(projectId, user.id);
    if (!role) throw forbidden();

    const members = await this.#listMembers(projectId);
    return { ...project.toPublic(), members };
  }

  async getAccess(projectId, userId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) return { exists: false, role: null };
    const member = await this.projectRepository.findMember(projectId, userId);
    return { exists: true, role: member ? member.role : null };
  }

  async isMember(projectId, userId) {
    return (await this.projectRepository.findMember(projectId, userId)) !== null;
  }

  async #listMembers(projectId) {
    const rows = await this.projectRepository.listMembers(projectId);
    const users = await Promise.all(rows.map((r) => this.userService.findById(r.userId)));
    return rows.map((r, i) => ({
      id: users[i].id,
      name: users[i].name,
      email: users[i].email,
      role: r.role,
    }));
  }

  async addMember({ currentUser, projectId, email }) {
    const { exists, role } = await this.getAccess(projectId, currentUser.id);
    if (!exists) throw projectNotFound();

    if (role !== 'owner') throw forbidden('Only the project owner can add members');

    if (!email || email.trim() === '') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email required');
    }

    const user = await this.userService.findByEmail(email);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    if (await this.isMember(projectId, user.id)) {
      throw new AppError(409, 'ALREADY_MEMBER', 'User is already a member');
    }
    await this.projectRepository.addMember(projectId, user.id, 'member');
    return this.#listMembers(projectId);
  }
}
