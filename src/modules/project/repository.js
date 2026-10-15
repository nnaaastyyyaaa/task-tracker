import { withRetry } from '../../utils/retry.js';
import { Project } from './entity.js';

export class ProjectRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findById(id) {
    const row = await withRetry(() => this.prisma.Project.findUnique({ where: { id } }));
    return row ? Project.fromEntity(row) : null;
  }

  async findByIds(ids) {
    const rows = await withRetry(() =>
      this.prisma.Project.findMany({
        where: { id: { in: ids } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      }),
    );
    return rows ? rows.map((row) => Project.fromEntity(row)) : null;
  }

  async createWithOwner(entity) {
    const row = await this.prisma.project.create({
      data: {
        ...entity,
        members: { create: { user_id: entity.owner_id, role: 'owner' } },
      },
    });
    return Project.fromEntity(row);
  }
}
