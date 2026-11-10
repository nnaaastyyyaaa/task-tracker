import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import projectRoutes from '../../src/modules/project/projectRoutes.js';

describe('project routes', () => {
  let app;
  let projectService;
  let checkUser;

  const user = { id: 1, name: 'Alice', role: 'team_lead' };

  beforeEach(async () => {
    projectService = {
      create: vi.fn(),
      list: vi.fn(),
      getById: vi.fn(),
      addMember: vi.fn(),
    };

    // Fake auth hook: no Authorization header -> 401, otherwise attaches the user.
    checkUser = vi.fn(async (request, reply) => {
      if (!request.headers.authorization) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } });
      }
      request.user = user;
    });

    app = Fastify();
    await app.register(projectRoutes, { projectService, checkUser });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['POST', '/projects'],
    ['GET', '/projects'],
    ['GET', '/projects/10'],
    ['POST', '/projects/10/members'],
  ])('%s %s returns 401 for an unauthenticated user', async (method, url) => {
    const res = await app.inject({
      method,
      url,
      payload: method === 'POST' ? {} : undefined,
    });

    expect(res.statusCode).toBe(401);
    expect(checkUser).toHaveBeenCalled();
    Object.values(projectService).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it('POST /projects passes the authenticated user to the service', async () => {
    projectService.create.mockResolvedValue({ id: 10, name: 'Alpha' });

    const res = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: 'Bearer test' },
      payload: { name: 'Alpha' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ data: { id: 10, name: 'Alpha' } });
    expect(projectService.create).toHaveBeenCalledWith(user, { name: 'Alpha' });
  });

  it('POST /projects/:projectId/members passes the parsed ID and body to the service', async () => {
    projectService.addMember.mockResolvedValue([{ id: 5, role: 'member' }]);

    const res = await app.inject({
      method: 'POST',
      url: '/projects/10/members',
      headers: { authorization: 'Bearer test' },
      payload: { email: 'new@example.com' },
    });

    expect(res.statusCode).toBe(201);
    expect(projectService.addMember).toHaveBeenCalledWith(user, 10, {
      email: 'new@example.com',
    });
  });
});
