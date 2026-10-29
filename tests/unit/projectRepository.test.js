import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectRepository } from '../../src/modules/project/repository.js';

describe('ProjectRepository', () => {
  let prisma;
  let repository;

  const row = { id: 10, name: 'Alpha', description: 'desc', owner_id: 1 };
  const publicProject = { id: 10, name: 'Alpha', description: 'desc', ownerId: 1 };

  beforeEach(() => {
    prisma = {
      Project: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      project: {
        create: vi.fn(),
      },
    };

    repository = new ProjectRepository(prisma);
  });

  describe('findById', () => {
    it('returns a Project entity when the project exists', async () => {
      prisma.Project.findUnique.mockResolvedValue(row);

      const result = await repository.findById(10);

      expect(prisma.Project.findUnique).toHaveBeenCalledWith({ where: { id: 10 } });
      expect(result.toPublic()).toEqual(publicProject);
    });

    it('returns null when the project does not exist', async () => {
      prisma.Project.findUnique.mockResolvedValue(null);

      await expect(repository.findById(999)).resolves.toBeNull();
    });
  });

  describe('findByIds', () => {
    it('returns projects sorted by name and then by id', async () => {
      prisma.Project.findMany.mockResolvedValue([row]);

      const result = await repository.findByIds([10, 11]);

      expect(prisma.Project.findMany).toHaveBeenCalledWith({
        where: { id: { in: [10, 11] } },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      });
      expect(result.map((p) => p.toPublic())).toEqual([publicProject]);
    });
  });

  describe('createWithOwner', () => {
    it('creates the project and the owner membership in one operation', async () => {
      const entity = { name: 'Alpha', description: 'desc', owner_id: 1 };
      prisma.project.create.mockResolvedValue({ id: 10, ...entity });

      const result = await repository.createWithOwner(entity);

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          ...entity,
          members: { create: { user_id: 1, role: 'owner' } },
        },
      });
      expect(result.toPublic()).toEqual(publicProject);
    });
  });
});
