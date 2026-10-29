import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskController } from '../../src/modules/task/controller.js';

describe('TaskController', () => {
  let taskService;
  let controller;
  let request;
  let reply;

  const user = { id: 1, name: 'Alice', role: 'team_lead' };

  beforeEach(() => {
    taskService = {
      listByProject: vi.fn(),
      create: vi.fn(),
      getById: vi.fn(),
      update: vi.fn(),
      changeStatus: vi.fn(),
      changeAssignee: vi.fn(),
      remove: vi.fn(),
    };

    controller = new TaskController({ taskService });

    request = { user, params: {}, query: {}, body: {} };

    reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('listByProject', () => {
    it('returns the tasks of the project with status 200', async () => {
      const tasks = [{ id: 5 }];
      request.params.projectId = '10';
      taskService.listByProject.mockResolvedValue(tasks);

      await controller.listByProject(request, reply);

      expect(taskService.listByProject).toHaveBeenCalledWith(user, 10, undefined);
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: tasks });
    });

    it('passes the assignee query parameter to the service', async () => {
      request.params.projectId = '10';
      request.query.assignee = 'me';
      taskService.listByProject.mockResolvedValue([]);

      await controller.listByProject(request, reply);

      expect(taskService.listByProject).toHaveBeenCalledWith(user, 10, 'me');
    });
  });

  describe('create', () => {
    it('creates a task and returns status 201', async () => {
      const task = { id: 5, title: 'Write tests' };
      request.params.projectId = '10';
      request.body = { title: 'Write tests', assigneeId: 2 };
      taskService.create.mockResolvedValue(task);

      await controller.create(request, reply);

      expect(taskService.create).toHaveBeenCalledWith(user, 10, request.body);
      expect(reply.code).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({ data: task });
    });
  });

  describe('getOne', () => {
    it('returns the task with status 200', async () => {
      const task = { id: 5 };
      request.params.taskId = '5';
      taskService.getById.mockResolvedValue(task);

      await controller.getOne(request, reply);

      expect(taskService.getById).toHaveBeenCalledWith(user, 5);
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: task });
    });
  });

  describe('update', () => {
    it('updates the task and returns status 200', async () => {
      const task = { id: 5, title: 'New title' };
      request.params.taskId = '5';
      request.body = { title: 'New title' };
      taskService.update.mockResolvedValue(task);

      await controller.update(request, reply);

      expect(taskService.update).toHaveBeenCalledWith(user, 5, request.body);
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: task });
    });
  });

  describe('changeStatus', () => {
    it('changes the status and returns status 200', async () => {
      const task = { id: 5, status: 'in_progress' };
      request.params.taskId = '5';
      request.body = { status: 'in_progress' };
      taskService.changeStatus.mockResolvedValue(task);

      await controller.changeStatus(request, reply);

      expect(taskService.changeStatus).toHaveBeenCalledWith(user, 5, request.body);
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: task });
    });
  });

  describe('changeAssignee', () => {
    it('changes the assignee and returns status 200', async () => {
      const task = { id: 5, assigneeId: 4 };
      request.params.taskId = '5';
      request.body = { assigneeId: 4 };
      taskService.changeAssignee.mockResolvedValue(task);

      await controller.changeAssignee(request, reply);

      expect(taskService.changeAssignee).toHaveBeenCalledWith(user, 5, request.body);
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: task });
    });
  });

  describe('remove', () => {
    it('deletes the task and returns status 204 without a body', async () => {
      request.params.taskId = '5';

      await controller.remove(request, reply);

      expect(taskService.remove).toHaveBeenCalledWith(user, 5);
      expect(reply.code).toHaveBeenCalledWith(204);
      expect(reply.send).toHaveBeenCalledWith();
    });
  });

  describe('error handling', () => {
    const handlers = [
      ['listByProject', 'listByProject', 'projectId'],
      ['create', 'create', 'projectId'],
      ['getOne', 'getById', 'taskId'],
      ['update', 'update', 'taskId'],
      ['changeStatus', 'changeStatus', 'taskId'],
      ['changeAssignee', 'changeAssignee', 'taskId'],
      ['remove', 'remove', 'taskId'],
    ];

    it.each(handlers)(
      '%s propagates errors thrown by the service',
      async (handler, serviceMethod, paramKey) => {
        const error = new Error('Service failure');
        request.params[paramKey] = '5';
        taskService[serviceMethod].mockRejectedValue(error);

        await expect(controller[handler](request, reply)).rejects.toBe(error);

        expect(reply.send).not.toHaveBeenCalled();
      },
    );

    it.each(handlers)(
      '%s rejects an invalid ID with 400 without calling the service',
      async (handler, serviceMethod, paramKey) => {
        request.params[paramKey] = 'abc';

        await expect(controller[handler](request, reply)).rejects.toMatchObject({
          status: 400,
        });

        expect(taskService[serviceMethod]).not.toHaveBeenCalled();
      },
    );
  });
});
