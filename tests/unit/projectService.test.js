import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectService } from '../../src/modules/project/service.js';
import { Project } from '../../src/modules/project/entity.js';

describe('ProjectService', () => {
  let projectRepository;
  let projectMemberService;
  let userService;
  let service;

  const lead = { id: 1, name: 'Lead', role: 'team_lead' };
  const member = { id: 2, name: 'Member', role: 'team_member' };

  const project = new Project({ id: 10, name: 'Alpha', description: 'desc', ownerId: 1 });
  const projectPublic = { id: 10, name: 'Alpha', description: 'desc', ownerId: 1 };

  beforeEach(() => {
    projectRepository = {
      findById: vi.fn(),
      findByIds: vi.fn(),
      createWithOwner: vi.fn(),
    };

    projectMemberService = {
      listProjectIdsOf: vi.fn(),
      getRole: vi.fn(),
      list: vi.fn(),
      add: vi.fn(),
    };

    userService = {
      findByEmail: vi.fn(),
    };

    service = new ProjectService({
      projectRepository,
      projectMemberService,
      userService,
    });
  });

  describe('create', () => {
    it('lets a team lead create a project owned by them', async () => {
      projectRepository.createWithOwner.mockResolvedValue(project);

      const result = await service.create(lead, { name: ' Alpha ', description: 'desc' });

      expect(projectRepository.createWithOwner).toHaveBeenCalledWith({
        name: 'Alpha',
        description: 'desc',
        owner_id: 1,
      });
      expect(result).toEqual(projectPublic);
    });

    it('forbids a team member from creating a project (403)', async () => {
      await expect(
        service.create(member, { name: 'Alpha', description: 'desc' }),
      ).rejects.toMatchObject({ status: 403 });

      expect(projectRepository.createWithOwner).not.toHaveBeenCalled();
    });

    it('checks permissions before validating the body (403 before 400)', async () => {
      await expect(
        service.create(member, { name: 'A', extra: true }),
      ).rejects.toMatchObject({
        status: 403,
      });
    });

    it.each([
      ['description is undefined', { name: 'Alpha' }],
      ['description is null', { name: 'Alpha', description: null }],
    ])('defaults description to an empty string when %s', async (_case, body) => {
      projectRepository.createWithOwner.mockResolvedValue(project);

      await service.create(lead, body);

      expect(projectRepository.createWithOwner).toHaveBeenCalledWith(
        expect.objectContaining({ description: '' }),
      );
    });

    it.each([
      ['name of exactly 2 characters', { name: 'Al' }],
      ['name of exactly 100 characters', { name: 'a'.repeat(100) }],
      [
        'description of exactly 1000 characters',
        { name: 'Alpha', description: 'a'.repeat(1000) },
      ],
    ])('accepts boundary value: %s', async (_case, body) => {
      projectRepository.createWithOwner.mockResolvedValue(project);

      await expect(service.create(lead, body)).resolves.toEqual(projectPublic);
    });

    it.each([
      ['name shorter than 2 characters', { name: 'A' }],
      ['name longer than 100 characters', { name: 'a'.repeat(101) }],
      ['name is only whitespace', { name: '   ' }],
      ['name is missing', { description: 'desc' }],
      ['name is not a string', { name: 42 }],
      [
        'description longer than 1000 characters',
        { name: 'Alpha', description: 'a'.repeat(1001) },
      ],
      ['description is not a string', { name: 'Alpha', description: 123 }],
      ['unknown field in body', { name: 'Alpha', extra: true }],
    ])('rejects request with 400: %s', async (_case, body) => {
      await expect(service.create(lead, body)).rejects.toMatchObject({ status: 400 });

      expect(projectRepository.createWithOwner).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns an empty array without querying projects when the user has none', async () => {
      projectMemberService.listProjectIdsOf.mockResolvedValue([]);

      await expect(service.list(member)).resolves.toEqual([]);

      expect(projectRepository.findByIds).not.toHaveBeenCalled();
    });

    it('returns public data of the projects the user belongs to', async () => {
      projectMemberService.listProjectIdsOf.mockResolvedValue([10]);
      projectRepository.findByIds.mockResolvedValue([project]);

      const result = await service.list(member);

      expect(projectMemberService.listProjectIdsOf).toHaveBeenCalledWith(2);
      expect(projectRepository.findByIds).toHaveBeenCalledWith([10]);
      expect(result).toEqual([projectPublic]);
    });
  });

  describe('getById', () => {
    it('returns 404 for a non-existent project without checking membership', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(service.getById(member, 999)).rejects.toMatchObject({
        status: 404,
        code: 'PROJECT_NOT_FOUND',
      });

      expect(projectMemberService.getRole).not.toHaveBeenCalled();
    });

    it('returns 403 when the user is not a member of the project', async () => {
      projectRepository.findById.mockResolvedValue(project);
      projectMemberService.getRole.mockResolvedValue(null);

      await expect(service.getById(member, 10)).rejects.toMatchObject({ status: 403 });

      expect(projectMemberService.list).not.toHaveBeenCalled();
    });

    it('returns the project with its members for a project member', async () => {
      const members = [{ id: 2, name: 'Member', email: 'm@example.com', role: 'member' }];
      projectRepository.findById.mockResolvedValue(project);
      projectMemberService.getRole.mockResolvedValue('member');
      projectMemberService.list.mockResolvedValue(members);

      await expect(service.getById(member, 10)).resolves.toEqual({
        ...projectPublic,
        members,
      });
      expect(projectMemberService.getRole).toHaveBeenCalledWith(10, 2);
    });
  });

  describe('getAccess', () => {
    it('reports a missing project without looking up the role', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(service.getAccess(999, 1)).resolves.toEqual({
        exists: false,
        role: null,
      });

      expect(projectMemberService.getRole).not.toHaveBeenCalled();
    });

    it('returns the role of the user in an existing project', async () => {
      projectRepository.findById.mockResolvedValue(project);
      projectMemberService.getRole.mockResolvedValue('owner');

      await expect(service.getAccess(10, 1)).resolves.toEqual({
        exists: true,
        role: 'owner',
      });
    });
  });

  describe('addMember', () => {
    const owner = lead;
    const body = { email: 'new@example.com' };

    const asOwner = () => {
      projectRepository.findById.mockResolvedValue(project);
      projectMemberService.getRole.mockResolvedValue('owner');
    };

    it('returns 404 for a non-existent project, even with an invalid body', async () => {
      projectRepository.findById.mockResolvedValue(null);

      await expect(service.addMember(owner, 999, { extra: true })).rejects.toMatchObject({
        status: 404,
      });

      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it.each([
      ['a regular project member', 'member'],
      ['a user who is not in the project', null],
    ])('forbids %s from adding members (403)', async (_case, role) => {
      projectRepository.findById.mockResolvedValue(project);
      projectMemberService.getRole.mockResolvedValue(role);

      await expect(service.addMember(member, 10, body)).rejects.toMatchObject({
        status: 403,
      });

      expect(userService.findByEmail).not.toHaveBeenCalled();
      expect(projectMemberService.add).not.toHaveBeenCalled();
    });

    it('rejects an invalid body from a non-owner with 403, not 400', async () => {
      projectRepository.findById.mockResolvedValue(project);
      projectMemberService.getRole.mockResolvedValue('member');

      await expect(service.addMember(member, 10, { extra: true })).rejects.toMatchObject({
        status: 403,
      });
    });

    it.each([
      ['email is missing', {}],
      ['email is empty', { email: '' }],
      ['email is only whitespace', { email: '   ' }],
      ['email is not a string', { email: 123 }],
      ['unknown field in body', { email: 'new@example.com', extra: true }],
    ])('rejects request from the owner with 400: %s', async (_case, invalidBody) => {
      asOwner();

      await expect(service.addMember(owner, 10, invalidBody)).rejects.toMatchObject({
        status: 400,
      });

      expect(userService.findByEmail).not.toHaveBeenCalled();
    });

    it('returns 404 when no user has the given email', async () => {
      asOwner();
      userService.findByEmail.mockResolvedValue(null);

      await expect(service.addMember(owner, 10, body)).rejects.toMatchObject({
        status: 404,
        code: 'USER_NOT_FOUND',
      });

      expect(projectMemberService.add).not.toHaveBeenCalled();
    });

    it('adds the user as a member and returns the updated member list', async () => {
      const members = [{ id: 5, name: 'New', email: 'new@example.com', role: 'member' }];
      asOwner();
      userService.findByEmail.mockResolvedValue({ id: 5 });
      projectMemberService.list.mockResolvedValue(members);

      const result = await service.addMember(owner, 10, body);

      expect(userService.findByEmail).toHaveBeenCalledWith('new@example.com');
      expect(projectMemberService.add).toHaveBeenCalledWith({
        projectId: 10,
        userId: 5,
        role: 'member',
      });
      expect(result).toBe(members);
    });

    it('propagates the conflict error when the user is already a member', async () => {
      const conflict = Object.assign(new Error('User is already a member'), {
        status: 409,
      });
      asOwner();
      userService.findByEmail.mockResolvedValue({ id: 5 });
      projectMemberService.add.mockRejectedValue(conflict);

      await expect(service.addMember(owner, 10, body)).rejects.toBe(conflict);

      expect(projectMemberService.list).not.toHaveBeenCalled();
    });
  });
});
