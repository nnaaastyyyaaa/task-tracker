import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { prisma, resetDb } from './helpers/db.js';
import { buildTestApp } from './helpers/app.js';

describe('Projects API (integration)', () => {
  let app;

  const leadUser = {
    name: 'Anastasia',
    email: 'email@gmail.com',
    password: 'password123',
    role: 'team_lead',
  };

  const otherLeadUser = {
    name: 'Olena',
    email: 'olena@gmail.com',
    password: 'password123',
    role: 'team_lead',
  };

  const memberUser = {
    name: 'Anna',
    email: 'anna@gmail.com',
    password: 'password123',
    role: 'team_member',
  };

  const project = {
    name: 'test',
    description: 'test',
  };

  let leadId;
  let memberId;
  let leadCookie;
  let otherLeadCookie;
  let memberCookie;

  async function register(data) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: data,
    });

    expect(response.statusCode).toBe(201);

    return response.json().data.id;
  }

  async function loginAndGetCookie(data) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: data.email, password: data.password },
    });

    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

    const sidCookie = cookies.find((cookie) => /^sid=/i.test(cookie));

    return sidCookie?.split(';')[0];
  }

  function createProject(payload = project, cookie = leadCookie) {
    return app.inject({
      method: 'POST',
      url: '/projects',
      payload,
      headers: { cookie },
    });
  }

  function addMember(projectId, email, cookie = leadCookie) {
    return app.inject({
      method: 'POST',
      url: `/projects/${projectId}/members`,
      payload: { email },
      headers: { cookie },
    });
  }

  const dbUnavailable = () =>
    Object.assign(new Error("Can't reach database server"), { code: 'P1001' });

  beforeAll(async () => {
    app = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDb();

    leadId = await register(leadUser);
    await register(otherLeadUser);
    memberId = await register(memberUser);

    leadCookie = await loginAndGetCookie(leadUser);
    otherLeadCookie = await loginAndGetCookie(otherLeadUser);
    memberCookie = await loginAndGetCookie(memberUser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /projects', () => {
    it('creates a project and registers the creator as its owner', async () => {
      const response = await createProject();

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.error).toBeUndefined();
      expect(body.data).toEqual({
        id: expect.any(Number),
        name: project.name,
        description: project.description,
        ownerId: leadId,
      });

      const fromDb = await prisma.project.findUnique({ where: { id: body.data.id } });

      expect(fromDb).toMatchObject({
        name: project.name,
        description: project.description,
        owner_id: leadId,
      });

      const members = await prisma.projectMember.findMany({
        where: { project_id: body.data.id },
      });

      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({ user_id: leadId, role: 'owner' });
    });

    it('trims the name and defaults description to an empty string', async () => {
      const response = await createProject({ name: '  Alpha  ' });

      expect(response.statusCode).toBe(201);
      expect(response.json().data).toMatchObject({ name: 'Alpha', description: '' });

      const fromDb = await prisma.project.findUnique({
        where: { id: response.json().data.id },
      });

      expect(fromDb.name).toBe('Alpha');
      expect(fromDb.description).toBe('');
    });

    it('treats a null description as empty', async () => {
      const response = await createProject({ name: 'Alpha', description: null });

      expect(response.statusCode).toBe(201);
      expect(response.json().data.description).toBe('');
    });

    it.each([
      ['a name of 2 characters', { name: 'ab' }],
      ['a name of 100 characters', { name: 'a'.repeat(100) }],
      [
        'a description of 1000 characters',
        { name: 'test', description: 'a'.repeat(1000) },
      ],
      ['an empty description', { name: 'test', description: '' }],
    ])('accepts %s', async (_, payload) => {
      const response = await createProject(payload);

      expect(response.statusCode).toBe(201);
      expect(await prisma.project.count()).toBe(1);
    });

    it.each([
      ['a missing name', { description: 'test' }],
      ['an empty name', { name: '' }],
      ['a name of 1 character', { name: 'a' }],
      ['a name that is 1 character after trim', { name: '  a  ' }],
      ['a name of 101 characters', { name: 'a'.repeat(101) }],
      ['a non-string name', { name: 123 }],
      [
        'a description of 1001 characters',
        { name: 'test', description: 'a'.repeat(1001) },
      ],
      ['a non-string description', { name: 'test', description: 123 }],
      ['an unknown field', { name: 'test', extra: 'value' }],
      ['a spoofed ownerId', { name: 'test', ownerId: 999 }],
    ])('returns 400 for %s and creates nothing', async (_, payload) => {
      const response = await createProject(payload);

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(await prisma.project.count()).toBe(0);
      expect(await prisma.projectMember.count()).toBe(0);
    });

    it('returns 403 for a team member and creates nothing', async () => {
      const response = await createProject(project, memberCookie);

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
      expect(await prisma.project.count()).toBe(0);
      expect(await prisma.projectMember.count()).toBe(0);
    });

    it('returns 403 rather than 400 for an invalid body from a team member', async () => {
      const response = await createProject({ name: '' }, memberCookie);

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    });

    it('returns 401 without a session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/projects',
        payload: project,
      });

      expect(response.statusCode).toBe(401);
      expect(await prisma.project.count()).toBe(0);
    });

    it('does not retry creation when the database is unavailable', async () => {
      const spy = vi.spyOn(prisma.project, 'create').mockRejectedValue(dbUnavailable());

      const response = await createProject();

      expect(response.statusCode).toBe(503);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /projects', () => {
    it('returns { data: [] } for a user without projects', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects',
        headers: { cookie: memberCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ data: [] });
    });

    it('returns only projects the user is a member of', async () => {
      const own = (await createProject({ name: 'Own project' })).json().data;
      await createProject({ name: 'Foreign project' }, otherLeadCookie);

      const response = await app.inject({
        method: 'GET',
        url: '/projects',
        headers: { cookie: leadCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toEqual([
        { id: own.id, name: 'Own project', description: '', ownerId: leadId },
      ]);
    });

    it('returns projects ordered by name and id', async () => {
      const beta = (await createProject({ name: 'Beta' })).json().data;
      const firstAlpha = (await createProject({ name: 'Alpha' })).json().data;
      const secondAlpha = (await createProject({ name: 'Alpha' })).json().data;

      const response = await app.inject({
        method: 'GET',
        url: '/projects',
        headers: { cookie: leadCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.map((item) => item.id)).toEqual([
        firstAlpha.id,
        secondAlpha.id,
        beta.id,
      ]);
    });

    it('shows a project to a user only after they are added as a member', async () => {
      const created = (await createProject()).json().data;

      const before = await app.inject({
        method: 'GET',
        url: '/projects',
        headers: { cookie: memberCookie },
      });

      expect(before.json().data).toEqual([]);

      const added = await addMember(created.id, memberUser.email);
      expect(added.statusCode).toBe(201);

      const after = await app.inject({
        method: 'GET',
        url: '/projects',
        headers: { cookie: memberCookie },
      });

      expect(after.json().data.map((item) => item.id)).toEqual([created.id]);
    });

    it('returns 503 with Retry-After after exhausting retries', async () => {
      const spy = vi
        .spyOn(prisma.projectMember, 'findMany')
        .mockRejectedValue(dbUnavailable());

      const response = await app.inject({
        method: 'GET',
        url: '/projects',
        headers: { cookie: leadCookie },
      });

      expect(response.statusCode).toBe(503);
      expect(response.headers['retry-after']).toBe('5');
      expect(spy).toHaveBeenCalledTimes(4);
    });
  });

  describe('GET /projects/:projectId', () => {
    it('returns the project with its members and without secrets', async () => {
      const created = (await createProject()).json().data;
      await addMember(created.id, memberUser.email);

      const response = await app.inject({
        method: 'GET',
        url: `/projects/${created.id}`,
        headers: { cookie: leadCookie },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();

      expect(body.error).toBeUndefined();
      expect(body.data).toMatchObject({
        id: created.id,
        name: project.name,
        description: project.description,
        ownerId: leadId,
      });

      const members = [...body.data.members].sort((a, b) => a.id - b.id);

      expect(members).toEqual([
        { id: leadId, name: leadUser.name, email: leadUser.email, role: 'owner' },
        { id: memberId, name: memberUser.name, email: memberUser.email, role: 'member' },
      ]);
      expect(response.body).not.toContain('password');
    });

    it('lets an added member read the project', async () => {
      const created = (await createProject()).json().data;
      await addMember(created.id, memberUser.email);

      const response = await app.inject({
        method: 'GET',
        url: `/projects/${created.id}`,
        headers: { cookie: memberCookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.id).toBe(created.id);
    });

    it('returns 403 for a user who is not a member', async () => {
      const created = (await createProject()).json().data;

      const response = await app.inject({
        method: 'GET',
        url: `/projects/${created.id}`,
        headers: { cookie: otherLeadCookie },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for a nonexistent project', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects/999999',
        headers: { cookie: leadCookie },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({
        error: { code: 'PROJECT_NOT_FOUND', message: expect.any(String) },
      });
    });

    it('returns 404 rather than 403 for a nonexistent project and a non-member', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/projects/999999',
        headers: { cookie: memberCookie },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('PROJECT_NOT_FOUND');
    });

    it.each(['abc', '0', '-1', '1.5', '2147483648'])(
      'returns 400 for the invalid id "%s"',
      async (id) => {
        const response = await app.inject({
          method: 'GET',
          url: `/projects/${id}`,
          headers: { cookie: leadCookie },
        });

        expect(response.statusCode).toBe(400);
        expect(response.json().error.code).toBe('VALIDATION_ERROR');
      },
    );
  });
});
