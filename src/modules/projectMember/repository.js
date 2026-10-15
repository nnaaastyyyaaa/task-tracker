import { withRetry } from '../../utils/retry.js';
import { ProjectMember } from './entity.js';

export class ProjectMemberRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async find(projectId, userId) {
    const row = await withRetry(() =>
      this.prisma.projectMember.findUnique({
        where: { project_id_user_id: { project_id: projectId, user_id: userId } },
      }),
    );
    return row ? ProjectMember.fromEntity(row) : null;
  }

  async add(projectId, userId, role) {
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

  async listByProject(projectId) {
    const rows = await withRetry(() =>
      this.prisma.projectMember.findMany({
        where: { project_id: projectId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    );
    return rows.map((row) => ProjectMember.fromEntity(row));
  }

  async listProjectIdsOf(userId) {
    const rows = await withRetry(() =>
      this.prisma.projectMember.findMany({
        where: { user_id: userId },
        select: { project_id: true },
      }),
    );
    return rows.map((row) => row.project_id);
  }
}
