import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskRepository } from '../../src/modules/task/repository.js';

describe('TaskRepository', () => {
  let prisma;
  let repository;

  const createdAt = new Date('2026-10-01T10:00:00.000Z');
  const updatedAt = new Date('2026-10-02T11:30:00.000Z');

  const row = {
    id: 5,
    project_id: 10,
    title: 'Write tests',
    description: 'desc',
    assignee_id: 2,
    priority: 'medium',
    status: 'todo',
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const mapped = {
    id: 5,
    projectId: 10,
    title: 'Write tests',
    description: 'desc',
    assigneeId: 2,
    priority: 'medium',
    status: 'todo',
    createdAt,
    updatedAt,
  };

  const prismaError = (code) =>
    Object.assign(new Error(`Prisma error ${code}`), { code });

  beforeEach(() => {
    prisma = {
      task: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      // TaskRepository.delete uses the capitalized accessor
      Task: {
        delete: vi.fn(),
      },
    };

    repository = new TaskRepository(prisma);
  });

  describe('create', () => {
    it('creates a task and returns the mapped result', async () => {
      const data = {
        project_id: 10,
        title: 'Write tests',
        description: 'desc',
        assignee_id: 2,
        priority: 'medium',
      };
      prisma.task.create.mockResolvedValue(row);

      const result = await repository.create(data);

      expect(prisma.task.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(mapped);
    });

    it('throws 422 when the assignee violates the foreign key (P2003)', async () => {
      prisma.task.create.mockRejectedValue(prismaError('P2003'));

      await expect(repository.create({})).rejects.toMatchObject({
        status: 422,
        code: 'ASSIGNEE_NOT_MEMBER',
      });
    });

    it('propagates unexpected database errors', async () => {
      const error = new Error('Database connection failed');
      prisma.task.create.mockRejectedValue(error);

      await expect(repository.create({})).rejects.toBe(error);
    });
  });

  describe('findById', () => {
    it('returns the mapped task when it exists', async () => {
      prisma.task.findUnique.mockResolvedValue(row);

      const result = await repository.findById(5);

      expect(prisma.task.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(result).toEqual(mapped);
    });

    it('returns null when the task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(repository.findById(999)).resolves.toBeNull();
    });
  });

  describe('findByProject', () => {
    it('returns all tasks of the project ordered by creation date and id', async () => {
      prisma.task.findMany.mockResolvedValue([row]);

      const result = await repository.findByProject(10);

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { project_id: 10 },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      });
      expect(result).toEqual([mapped]);
    });

    it('filters by assignee when an assignee ID is given', async () => {
      prisma.task.findMany.mockResolvedValue([row]);

      await repository.findByProject(10, 2);

      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { project_id: 10, assignee_id: 2 },
        orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
      });
    });

    it('returns an empty array when the project has no tasks', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      await expect(repository.findByProject(10)).resolves.toEqual([]);
    });

    it('returns null when the database returns no result', async () => {
      prisma.task.findMany.mockResolvedValue(null);

      await expect(repository.findByProject(10)).resolves.toBeNull();
    });
  });

  describe('update', () => {
    it('updates the given fields and returns the mapped task', async () => {
      prisma.task.update.mockResolvedValue(row);

      const result = await repository.update(5, { title: 'New title' });

      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: { title: 'New title' },
      });
      expect(result).toEqual(mapped);
    });

    it('throws 404 when the task does not exist (P2025)', async () => {
      prisma.task.update.mockRejectedValue(prismaError('P2025'));

      await expect(repository.update(999, { title: 'x' })).rejects.toMatchObject({
        status: 404,
        code: 'NOT_FOUND',
      });
    });

    it('throws 422 when the new assignee violates the foreign key (P2003)', async () => {
      prisma.task.update.mockRejectedValue(prismaError('P2003'));

      await expect(repository.update(5, { assignee_id: 99 })).rejects.toMatchObject({
        status: 422,
        code: 'ASSIGNEE_NOT_MEMBER',
      });
    });

    it('propagates unexpected database errors', async () => {
      const error = new Error('Database connection failed');
      prisma.task.update.mockRejectedValue(error);

      await expect(repository.update(5, { title: 'x' })).rejects.toBe(error);
    });
  });

  describe('updateStatus', () => {
    it('changes the status only if it still equals the expected one', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 1 });
      prisma.task.findUnique.mockResolvedValue({ ...row, status: 'in_progress' });

      const result = await repository.updateStatus(5, 'todo', 'in_progress');

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: 5, status: 'todo' },
        data: { status: 'in_progress' },
      });
      expect(prisma.task.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(result).toEqual({ ...mapped, status: 'in_progress' });
    });

    it('returns null without re-reading the task when the status was changed concurrently', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 0 });

      await expect(repository.updateStatus(5, 'todo', 'in_progress')).resolves.toBeNull();

      expect(prisma.task.findUnique).not.toHaveBeenCalled();
    });

    it('returns null when the task disappears after the update', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 1 });
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(repository.updateStatus(5, 'todo', 'in_progress')).resolves.toBeNull();
    });
  });

  describe('delete', () => {
    it('deletes the task by ID', async () => {
      prisma.Task.delete.mockResolvedValue(row);

      const result = await repository.delete(5);

      expect(prisma.Task.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(result).toBe(row);
    });

    it('throws 404 when the task does not exist (P2025)', async () => {
      prisma.Task.delete.mockRejectedValue(prismaError('P2025'));

      await expect(repository.delete(999)).rejects.toMatchObject({
        status: 404,
        code: 'TASK_NOT_FOUND',
      });
    });

    it('propagates unexpected database errors', async () => {
      const error = new Error('Database connection failed');
      prisma.Task.delete.mockRejectedValue(error);

      await expect(repository.delete(5)).rejects.toBe(error);
    });
  });
});
