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
    const row = await this.prisma.Task.findUnique({ where: { id } });
    return row ? Task.fromEntity(row) : null;
  }

  async findByProject(projectId, assigneeId) {
    const where = { project_id: projectId };

    if (assigneeId !== undefined) {
      where.assignee_id = assigneeId;
    }
    const rows = await this.prisma.Task.findMany({ where });
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
    const result = await this.prisma.Task.updateMany({
      where: {
        id,
        status: expectedStatus,
      },
      data: {
        status: newStatus,
      },
    });

    if (result.count === 0) {
      return null;
    }
    const updated = await this.prisma.Task.findUnique({
      where: { id },
    });
    return updated ? Task.fromEntity(updated) : null;
  }

  async delete(id) {
    try {
      return await this.prisma.Task.delete({
        where: { id },
      });
    } catch (e) {
      if (e.code === 'P2025') {
        throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
      }

      throw e;
    }
  }
}
