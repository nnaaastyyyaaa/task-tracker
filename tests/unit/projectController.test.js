import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectController } from '../../src/modules/project/controller.js';

describe('ProjectController', () => {
  let projectService;
  let controller;
  let request;
  let reply;

  const user = { id: 1, name: 'Alice', role: 'team_lead' };

  beforeEach(() => {
    projectService = {
      create: vi.fn(),
      list: vi.fn(),
      getById: vi.fn(),
      addMember: vi.fn(),
    };

    controller = new ProjectController({ projectService });

    request = { user, body: {}, params: {} };

    reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('create', () => {
    it('creates a project for the current user and returns status 201', async () => {
      const project = { id: 10, name: 'Alpha' };
      request.body = { name: 'Alpha' };
      projectService.create.mockResolvedValue(project);

      await controller.create(request, reply);

      expect(projectService.create).toHaveBeenCalledWith(user, request.body);
      expect(reply.code).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({ data: project });
    });

    it('propagates errors thrown by the service', async () => {
      const error = new Error('Forbidden');
      projectService.create.mockRejectedValue(error);

      await expect(controller.create(request, reply)).rejects.toBe(error);

      expect(reply.send).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns the projects of the current user with status 200', async () => {
      const projects = [{ id: 10 }];
      projectService.list.mockResolvedValue(projects);

      await controller.list(request, reply);

      expect(projectService.list).toHaveBeenCalledWith(user);
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: projects });
    });

    it('returns an empty list as { data: [] }', async () => {
      projectService.list.mockResolvedValue([]);

      await controller.list(request, reply);

      expect(reply.send).toHaveBeenCalledWith({ data: [] });
    });
  });

  describe('getOne', () => {
    it('parses the project ID from the URL and returns the project with status 200', async () => {
      const project = { id: 10, members: [] };
      request.params.projectId = '10';
      projectService.getById.mockResolvedValue(project);

      await controller.getOne(request, reply);

      expect(projectService.getById).toHaveBeenCalledWith(user, 10);
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: project });
    });
  });

  describe('addMember', () => {
    it('adds a member and returns the member list with status 201', async () => {
      const members = [{ id: 5, role: 'member' }];
      request.params.projectId = '10';
      request.body = { email: 'new@example.com' };
      projectService.addMember.mockResolvedValue(members);

      await controller.addMember(request, reply);

      expect(projectService.addMember).toHaveBeenCalledWith(user, 10, request.body);
      expect(reply.code).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({ data: members });
    });

    it('rejects an invalid project ID with 400 without calling the service', async () => {
      request.params.projectId = '1.5';

      await expect(controller.addMember(request, reply)).rejects.toMatchObject({
        status: 400,
      });

      expect(projectService.addMember).not.toHaveBeenCalled();
    });
  });
});
