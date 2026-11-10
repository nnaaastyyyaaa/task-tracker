import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import taskRoutes from '../../src/modules/task/taskRoutes.js';

describe('task routes', () => {
  let app;
  let taskService;
  let checkUser;

  const user = { id: 1, name: 'Alice', role: 'team_lead' };
  const authHeaders = { authorization: 'Bearer test' };

  const routes = [
    // [method, url, payload, serviceMethod, expected service args, expected status]
    ['GET', '/projects/10/tasks', undefined, 'listByProject', [user, 10, undefined], 200],
    [
      'GET',
      '/projects/10/tasks?assignee=me',
      undefined,
      'listByProject',
      [user, 10, 'me'],
      200,
    ],
    [
      'POST',
      '/projects/10/tasks',
      { title: 'Write tests' },
      'create',
      [user, 10, { title: 'Write tests' }],
      201,
    ],
    ['GET', '/tasks/5', undefined, 'getById', [user, 5], 200],
    [
      'PATCH',
      '/tasks/5',
      { title: 'New title' },
      'update',
      [user, 5, { title: 'New title' }],
      200,
    ],
    [
      'PATCH',
      '/tasks/5/status',
      { status: 'review' },
      'changeStatus',
      [user, 5, { status: 'review' }],
      200,
    ],
    [
      'PATCH',
      '/tasks/5/assignee',
      { assigneeId: 4 },
      'changeAssignee',
      [user, 5, { assigneeId: 4 }],
      200,
    ],
    ['DELETE', '/tasks/5', undefined, 'remove', [user, 5], 204],
  ];

  beforeEach(async () => {
    taskService = {
      listByProject: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 5 }),
      getById: vi.fn().mockResolvedValue({ id: 5 }),
      update: vi.fn().mockResolvedValue({ id: 5 }),
      changeStatus: vi.fn().mockResolvedValue({ id: 5 }),
      changeAssignee: vi.fn().mockResolvedValue({ id: 5 }),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    // Fake auth hook: no Authorization header -> 401, otherwise attaches the user.
    checkUser = vi.fn(async (request, reply) => {
      if (!request.headers.authorization) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } });
      }
      request.user = user;
    });

    app = Fastify();
    await app.register(taskRoutes, { taskService, checkUser });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(routes)(
    '%s %s returns 401 for an unauthenticated user',
    async (method, url, payload) => {
      const res = await app.inject({ method, url, payload });

      expect(res.statusCode).toBe(401);
      expect(checkUser).toHaveBeenCalledTimes(1);
      Object.values(taskService).forEach((fn) => expect(fn).not.toHaveBeenCalled());
    },
  );

  it.each(routes)(
    '%s %s calls the right service method for an authenticated user',
    async (method, url, payload, serviceMethod, args, status) => {
      const res = await app.inject({ method, url, payload, headers: authHeaders });

      expect(res.statusCode).toBe(status);
      expect(taskService[serviceMethod]).toHaveBeenCalledWith(...args);
    },
  );

  it('wraps successful responses in a data envelope', async () => {
    taskService.getById.mockResolvedValue({ id: 5, title: 'Write tests' });

    const res = await app.inject({
      method: 'GET',
      url: '/tasks/5',
      headers: authHeaders,
    });

    expect(res.json()).toEqual({ data: { id: 5, title: 'Write tests' } });
  });

  it('DELETE /tasks/:taskId returns an empty body', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/tasks/5',
      headers: authHeaders,
    });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
  });
});
