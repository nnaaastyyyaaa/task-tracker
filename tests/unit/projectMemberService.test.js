import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMemberService } from '../../src/modules/projectMember/service.js';
import { ProjectMember } from '../../src/modules/projectMember/entity.js';

describe('ProjectMemberService', () => {
  let projectMemberRepository;
  let service;

  beforeEach(() => {
    projectMemberRepository = {
      find: vi.fn(),
      add: vi.fn(),
      listByProject: vi.fn(),
      listProjectIdsOf: vi.fn(),
    };

    service = new ProjectMemberService({ projectMemberRepository });
  });

  describe('getRole', () => {
    it('returns the role of a project member', async () => {
      projectMemberRepository.find.mockResolvedValue(
        new ProjectMember({ projectId: 10, userId: 1, role: 'owner' }),
      );

      await expect(service.getRole(10, 1)).resolves.toBe('owner');
      expect(projectMemberRepository.find).toHaveBeenCalledWith(10, 1);
    });

    it('returns null when the user is not a member', async () => {
      projectMemberRepository.find.mockResolvedValue(null);

      await expect(service.getRole(10, 99)).resolves.toBeNull();
    });
  });

  describe('isMember', () => {
    it('returns true for a member and false for a non-member', async () => {
      projectMemberRepository.find
        .mockResolvedValueOnce(
          new ProjectMember({ projectId: 10, userId: 2, role: 'member' }),
        )
        .mockResolvedValueOnce(null);

      await expect(service.isMember(10, 2)).resolves.toBe(true);
      await expect(service.isMember(10, 99)).resolves.toBe(false);
    });
  });

  describe('list', () => {
    it('returns public member data without internal fields', async () => {
      projectMemberRepository.listByProject.mockResolvedValue([
        new ProjectMember({
          projectId: 10,
          userId: 1,
          role: 'owner',
          user: { id: 1, name: 'Alice', email: 'alice@example.com' },
        }),
        new ProjectMember({ projectId: 10, userId: 2, role: 'member' }),
      ]);

      await expect(service.list(10)).resolves.toEqual([
        { id: 1, name: 'Alice', email: 'alice@example.com', role: 'owner' },
        { id: 2, name: null, email: null, role: 'member' },
      ]);
    });
  });

  describe('listProjectIdsOf', () => {
    it('delegates to the repository', async () => {
      projectMemberRepository.listProjectIdsOf.mockResolvedValue([10, 11]);

      await expect(service.listProjectIdsOf(1)).resolves.toEqual([10, 11]);
      expect(projectMemberRepository.listProjectIdsOf).toHaveBeenCalledWith(1);
    });
  });

  describe('add', () => {
    it('adds a user with the default role "member"', async () => {
      projectMemberRepository.add.mockResolvedValue(true);

      await service.add({ projectId: 10, userId: 5 });

      expect(projectMemberRepository.add).toHaveBeenCalledWith(10, 5, 'member');
    });

    it('adds a user with an explicit valid role', async () => {
      projectMemberRepository.add.mockResolvedValue(true);

      await service.add({ projectId: 10, userId: 1, role: 'owner' });

      expect(projectMemberRepository.add).toHaveBeenCalledWith(10, 1, 'owner');
    });

    it('rejects an invalid role with 400 without touching the repository', async () => {
      await expect(
        service.add({ projectId: 10, userId: 5, role: 'admin' }),
      ).rejects.toMatchObject({ status: 400 });

      expect(projectMemberRepository.add).not.toHaveBeenCalled();
    });

    it('throws 409 when the user is already a member', async () => {
      projectMemberRepository.add.mockResolvedValue(false);

      await expect(service.add({ projectId: 10, userId: 5 })).rejects.toMatchObject({
        status: 409,
        code: 'ALREADY_MEMBER',
      });
    });
  });
});
