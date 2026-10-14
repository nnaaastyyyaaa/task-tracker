import { Project } from './entity.js';

export class ProjectRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findById(id) {
    const row = await this.prisma.Project.findUnique({ where: { id } });
    return row ? Project.fromEntity(row) : null;
  }

  async findByIds(ids) {
    const rows = await this.prisma.Project.findMany({ where: { id: { in: ids } } });
    return rows ? rows.map((row) => Project.fromEntity(row)) : null;
  }

  async create(project) {
    const created = await this.prisma.Project.create({ data: project });
    return created ? Project.fromEntity(created) : null;
  }

  #toMember(row) {
    return { projectId: row.project_id, userId: row.user_id, role: row.role };
  }

  async addMember(projectId, userId, role) {
    try {
      await this.prisma.projectMember.create({
        data: { project_id: projectId, user_id: userId, role },
      });
      return true;
    } catch (e) {
      if (e.code === 'P2002') return false;
      throw e;
    }
  }

  async findMember(projectId, userId) {
    const row = await this.prisma.ProjectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: userId,
        },
      },
    });
    return row ? this.#toMember(row) : null;
  }

  async listMembers(projectId) {
    const rows = await this.prisma.ProjectMember.findMany({
      where: {
        project_id: projectId,
      },
    });
    return rows ? rows.map((row) => this.#toMember(row)) : null;
  }

  async listMembershipsOf(userId) {
    const rows = await this.prisma.ProjectMember.findMany({
      where: {
        user_id: userId,
      },
    });

    return rows ? rows.map((row) => this.#toMember(row)) : null;
  }
}
