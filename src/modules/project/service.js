import { AppError } from '../../utils/errorHandler.js';
import { checkBody, str } from '../../utils/validation.js';
import { Project } from './entity.js';

const projectNotFound = () => new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
const forbidden = (message = 'Access denied') => new AppError(403, 'FORBIDDEN', message);

export class ProjectService {
  constructor({ projectRepository, projectMemberService, userService }) {
    this.projectRepository = projectRepository;
    this.projectMemberService = projectMemberService;
    this.userService = userService;
  }

  async create(user, body) {
    if (user.role !== 'team_lead') {
      throw forbidden('Only a team lead can create projects');
    }

    checkBody(body, ['name', 'description']);

    const name = str(body.name, 'name', { min: 2, max: 100 });
    const description =
      body.description === undefined || body.description === null
        ? ''
        : str(body.description, 'description', { max: 1000 });

    const entity = new Project({
      name,
      description,
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

  async addMember(currentUser, projectId, body) {
    const { exists, role } = await this.getAccess(projectId, currentUser.id);
    if (!exists) throw projectNotFound();
    if (role !== 'owner') throw forbidden('Only the project owner can add members');

    checkBody(body, ['email']);
    if (typeof body.email !== 'string' || body.email.trim() === '') {
      throw new AppError(400, 'VALIDATION_ERROR', 'Email required');
    }

    const user = await this.userService.findByEmail(body.email);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    await this.projectMemberService.add({ projectId, userId: user.id, role: 'member' });
    return this.projectMemberService.list(projectId);
  }
}
