import { Task } from './entity.js';
import { AppError } from '../../utils/errorHandler.js';

export class TaskRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create(task) {
    const row = await this.prisma.Task.create({ data: task });
    return row ? Task.fromEntity(row) : null;
  }

  async findById(id) {
    // const row = this.db.tasks.get(id);
    const row = await this.prisma.Task.findUnique({ where: { id } });
    return row ? Task.fromEntity(row) : null;
  }

  async findByProject(projectId, assigneeId) {
    const rows = await this.prisma.Task.findMany({
      where: {
        project_id: projectId,
        assignee_id: assigneeId,
      },
    });
    return rows ? rows.map((row) => Task.fromEntity(row)) : null;
  }

  async update(id, fields) {
    try {
      const row = await this.prisma.Task.update({
        where: { id },
        data: fields,
      });
      return row ? Task.fromEntity(row) : null;
    } catch (e) {
      if (e.code === 'P2025') throw new AppError(404, 'NOT_FOUND', 'Task not found');
      throw e;
    }
  }

  async updateStatus(id, expectedStatus, newStatus) {
    try {
      const row = await this.prisma.Task.findUnique({ where: { id } });
      if (!row || row.status !== expectedStatus) return null;
      const updated = await this.prisma.Task.update({
        where: { id },
        data: { status: newStatus },
      });
      return updated ? Task.fromEntity(updated) : null;
    } catch (e) {
      if (e.code === 'P2025') throw new AppError(404, 'NOT_FOUND', 'Task not found');
      throw e;
    }
  }

  async delete(id) {
    return await this.prisma.Task.delete({ where: { id } });
  }
}
