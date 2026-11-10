import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMemberRepository } from '../../src/modules/projectMember/repository.js';

describe('ProjectMemberRepository', () => {
  let prisma;
  let repository;

  beforeEach(() => {
    prisma = {
      projectMember: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };

    repository = new ProjectMemberRepository(prisma);
  });

  describe('find', () => {
    it('looks up a membership by the composite key and returns an entity', async () => {
      prisma.projectMember.findUnique.mockResolvedValue({
        project_id: 10,
        user_id: 1,
        role: 'owner',
      });

      const result = await repository.find(10, 1);

      expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: { project_id_user_id: { project_id: 10, user_id: 1 } },
      });
      expect(result).toMatchObject({ projectId: 10, userId: 1, role: 'owner' });
    });

    it('returns null when there is no membership', async () => {
      prisma.projectMember.findUnique.mockResolvedValue(null);

      await expect(repository.find(10, 99)).resolves.toBeNull();
    });
  });

  describe('add', () => {
    it('creates a membership and returns true', async () => {
      prisma.projectMember.create.mockResolvedValue({});

      await expect(repository.add(10, 5, 'member')).resolves.toBe(true);

      expect(prisma.projectMember.create).toHaveBeenCalledWith({
        data: { project_id: 10, user_id: 5, role: 'member' },
      });
    });

    it('returns false when the membership already exists (P2002)', async () => {
      prisma.projectMember.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(repository.add(10, 5, 'member')).resolves.toBe(false);
    });

    it('propagates unexpected database errors', async () => {
      const error = new Error('Database connection failed');
      prisma.projectMember.create.mockRejectedValue(error);

      await expect(repository.add(10, 5, 'member')).rejects.toBe(error);
    });
  });

  describe('listByProject', () => {
    it('returns members of the project together with basic user data', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        {
          project_id: 10,
          user_id: 1,
          role: 'owner',
          user: { id: 1, name: 'Alice', email: 'alice@example.com' },
        },
      ]);

      const result = await repository.listByProject(10);

      expect(prisma.projectMember.findMany).toHaveBeenCalledWith({
        where: { project_id: 10 },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      expect(result[0].toPublic()).toEqual({
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        role: 'owner',
      });
    });

    it('never selects the password hash of the users', async () => {
      prisma.projectMember.findMany.mockResolvedValue([]);

      await repository.listByProject(10);

      const [{ include }] = prisma.projectMember.findMany.mock.calls[0];
      expect(include.user.select).not.toHaveProperty('password_hash');
    });
  });

  describe('listProjectIdsOf', () => {
    it('returns only the project IDs of the user', async () => {
      prisma.projectMember.findMany.mockResolvedValue([
        { project_id: 10 },
        { project_id: 11 },
      ]);

      await expect(repository.listProjectIdsOf(1)).resolves.toEqual([10, 11]);

      expect(prisma.projectMember.findMany).toHaveBeenCalledWith({
        where: { user_id: 1 },
        select: { project_id: true },
      });
    });
  });
});
