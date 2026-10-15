import { withRetry } from '../../utils/retry.js';
import { Task } from './entity.js';
import { AppError } from '../../utils/errorHandler.js';

const notMember = () =>
  new AppError(422, 'ASSIGNEE_NOT_MEMBER', 'Assignee is not a member of the project');

export class TaskRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create(task) {
    try {
      const row = await this.prisma.task.create({ data: task });
      return Task.fromEntity(row);
    } catch (e) {
      if (e.code === 'P2003') throw notMember();
      throw e;
    }
  }

  async findById(id) {
    const row = await withRetry(() => this.prisma.task.findUnique({ where: { id } }));
    return row ? Task.fromEntity(row) : null;
  }

  async findByProject(projectId, assigneeId) {
    const where = { project_id: projectId };

    if (assigneeId !== undefined) {
      where.assignee_id = assigneeId;
    }
    const rows = await withRetry(() =>
      this.prisma.task.findMany({
        where,
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      }),
    );
    return rows ? rows.map((row) => Task.fromEntity(row)) : null;
  }

  async update(id, fields) {
    try {
      const row = await this.prisma.task.update({
        where: { id },
        data: fields,
      });
      return Task.fromEntity(row);
    } catch (e) {
      if (e.code === 'P2025') throw new AppError(404, 'NOT_FOUND', 'Task not found');
      if (e.code === 'P2003') throw notMember();
      throw e;
    }
  }

  async updateStatus(id, expectedStatus, newStatus) {
    const result = await withRetry(() =>
      this.prisma.task.updateMany({
        where: {
          id,
          status: expectedStatus,
        },
        data: {
          status: newStatus,
        },
      }),
    );

    if (result.count === 0) {
      return null;
    }
    const updated = await withRetry(() =>
      this.prisma.task.findUnique({
        where: { id },
      }),
    );
    return updated ? Task.fromEntity(updated) : null;
  }

  async delete(id) {
    try {
      return await withRetry(() =>
        this.prisma.Task.delete({
          where: { id },
        }),
      );
    } catch (e) {
      if (e.code === 'P2025') {
        throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
      }
      throw e;
    }
  }
}
