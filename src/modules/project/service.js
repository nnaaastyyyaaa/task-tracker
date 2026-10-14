import { AppError } from '../../utils/errorHandler.js';
import { Project } from './entity.js';

const projectNotFound = () => new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
const forbidden = (message = 'Access denied') => new AppError(403, 'FORBIDDEN', message);

export class ProjectService {
  constructor({ projectRepository, projectMemberService }) {
    this.projectRepository = projectRepository;
    this.projectMemberService = projectMemberService;
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
    const project = await this.projectRepository.createWithOwner(entity);
    return project.toPublic();
  }

  async list(user) {
    const ids = await this.projectMemberService.listProjectIdsOf(user.id);
    if (ids.length === 0) return [];
    const projects = await this.projectRepository.findByIds(ids);
    return projects.map((p) => p.toPublic());
  }

  async getById(user, projectId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) throw projectNotFound();

    const role = await this.projectMemberService.getRole(projectId, user.id);
    if (!role) throw forbidden();

    const members = await this.projectMemberService.list(projectId);
    return { ...project.toPublic(), members };
  }

  async getAccess(projectId, userId) {
    const project = await this.projectRepository.findById(projectId);
    if (!project) return { exists: false, role: null };
    const role = await this.projectMemberService.getRole(projectId, userId);
    return { exists: true, role };
  }

  async assertExists(projectId) {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw projectNotFound();
    }

    return project;
  }
}
