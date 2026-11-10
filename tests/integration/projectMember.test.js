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

describe('Project members API (integration)', () => {
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

  const outsiderUser = {
    name: 'Nastya',
    email: 'nastya@gmail.com',
    password: 'password123',
    role: 'team_member',
  };

  const project = {
    name: 'test',
    description: 'test',
  };

  let leadId;
  let memberId;
  let outsiderId;
  let projectId;
  let leadCookie;
  let otherLeadCookie;
  let memberCookie;
  let outsiderCookie;

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

  function addMember(payload, cookie = leadCookie, id = projectId) {
    return app.inject({
      method: 'POST',
      url: `/projects/${id}/members`,
      payload,
      headers: { cookie },
    });
  }

  function countMembers() {
    return prisma.projectMember.count({ where: { project_id: projectId } });
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
    outsiderId = await register(outsiderUser);

    leadCookie = await loginAndGetCookie(leadUser);
    otherLeadCookie = await loginAndGetCookie(otherLeadUser);
    memberCookie = await loginAndGetCookie(memberUser);
    outsiderCookie = await loginAndGetCookie(outsiderUser);

    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: project,
      headers: { cookie: leadCookie },
    });

    expect(response.statusCode).toBe(201);
    projectId = response.json().data.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /projects/:projectId/members', () => {
    it('adds a member by email and returns the members list', async () => {
      const response = await addMember({ email: memberUser.email });

      expect(response.statusCode).toBe(201);

      const body = response.json();

      expect(body.error).toBeUndefined();

      const members = [...body.data].sort((a, b) => a.id - b.id);

      expect(members).toEqual([
        { id: leadId, name: leadUser.name, email: leadUser.email, role: 'owner' },
        { id: memberId, name: memberUser.name, email: memberUser.email, role: 'member' },
      ]);
      expect(response.body).not.toContain('password');

      const fromDb = await prisma.projectMember.findUnique({
        where: { project_id_user_id: { project_id: projectId, user_id: memberId } },
      });

      expect(fromDb).toMatchObject({ role: 'member' });
    });

    it('gives the added user access to the project', async () => {
      const before = await app.inject({
        method: 'GET',
        url: `/projects/${projectId}`,
        headers: { cookie: memberCookie },
      });

      expect(before.statusCode).toBe(403);

      const added = await addMember({ email: memberUser.email });
      expect(added.statusCode).toBe(201);

      const after = await app.inject({
        method: 'GET',
        url: `/projects/${projectId}`,
        headers: { cookie: memberCookie },
      });

      expect(after.statusCode).toBe(200);
    });

    it('returns 404 for an unknown email and adds nobody', async () => {
      const response = await addMember({ email: 'unknown@gmail.com' });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('USER_NOT_FOUND');
      expect(await countMembers()).toBe(1);
    });

    it('returns 409 when the user is already a member', async () => {
      const first = await addMember({ email: memberUser.email });
      expect(first.statusCode).toBe(201);

      const second = await addMember({ email: memberUser.email });

      expect(second.statusCode).toBe(409);
      expect(second.json().error.code).toBe('ALREADY_MEMBER');
      expect(await countMembers()).toBe(2);
    });

    it('returns 409 when the owner is added again and keeps the owner role', async () => {
      const response = await addMember({ email: leadUser.email });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('ALREADY_MEMBER');

      const fromDb = await prisma.projectMember.findUnique({
        where: { project_id_user_id: { project_id: projectId, user_id: leadId } },
      });

      expect(fromDb.role).toBe('owner');
      expect(await countMembers()).toBe(1);
    });

    it('lets only one of two parallel requests add the same user', async () => {
      const responses = await Promise.all([
        addMember({ email: memberUser.email }),
        addMember({ email: memberUser.email }),
      ]);

      expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 409]);
      expect(await countMembers()).toBe(2);
    });

    it('returns 403 for a project member who is not the owner', async () => {
      await addMember({ email: memberUser.email });

      const response = await addMember({ email: outsiderUser.email }, memberCookie);

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
      expect(await countMembers()).toBe(2);
    });

    it('returns 403 for a user outside the project', async () => {
      const response = await addMember({ email: outsiderUser.email }, outsiderCookie);

      expect(response.statusCode).toBe(403);
      expect(await countMembers()).toBe(1);
    });

    it('returns 403 for a team lead who does not own the project', async () => {
      const response = await addMember({ email: memberUser.email }, otherLeadCookie);

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
      expect(await countMembers()).toBe(1);
    });

    it('returns 404 for a nonexistent project', async () => {
      const response = await addMember({ email: memberUser.email }, leadCookie, 999999);

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('PROJECT_NOT_FOUND');
    });

    it('returns 404 rather than 400 or 403 for a nonexistent project with an invalid body', async () => {
      const asOwner = await addMember({}, leadCookie, 999999);
      const asStranger = await addMember({}, outsiderCookie, 999999);

      expect(asOwner.statusCode).toBe(404);
      expect(asStranger.statusCode).toBe(404);
    });

    it('returns 403 rather than 400 for an invalid body from a non-owner', async () => {
      const response = await addMember({}, outsiderCookie);

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    });

    it.each([
      ['a missing email', {}],
      ['an empty email', { email: '' }],
      ['a blank email', { email: '   ' }],
      ['a non-string email', { email: 123 }],
      ['an unknown field', { email: 'anna@gmail.com', extra: 'value' }],
      ['a role injected into the body', { email: 'anna@gmail.com', role: 'owner' }],
    ])('returns 400 for %s from the owner and adds nobody', async (_, payload) => {
      const response = await addMember(payload);

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(await countMembers()).toBe(1);
    });

    it('returns 400 for an invalid project id', async () => {
      const response = await addMember({ email: memberUser.email }, leadCookie, 'abc');

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('does not retry adding a member when the database is unavailable', async () => {
      const spy = vi
        .spyOn(prisma.projectMember, 'create')
        .mockRejectedValue(dbUnavailable());

      const response = await addMember({ email: memberUser.email });

      expect(response.statusCode).toBe(503);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('retries the membership lookup and returns 503 with Retry-After', async () => {
      const spy = vi
        .spyOn(prisma.projectMember, 'findUnique')
        .mockRejectedValue(dbUnavailable());

      const response = await app.inject({
        method: 'GET',
        url: `/projects/${projectId}`,
        headers: { cookie: leadCookie },
      });

      expect(response.statusCode).toBe(503);
      expect(response.headers['retry-after']).toBe('5');
      expect(spy).toHaveBeenCalledTimes(4);
    });
  });

  describe('database constraints on project members', () => {
    it('enforces the unique (project, user) pair (P2002)', async () => {
      await expect(
        prisma.projectMember.create({
          data: { project_id: projectId, user_id: leadId, role: 'member' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      expect(await countMembers()).toBe(1);
    });

    it('rejects a membership for a nonexistent user (P2003)', async () => {
      await expect(
        prisma.projectMember.create({
          data: { project_id: projectId, user_id: 999999, role: 'member' },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('rejects a membership for a nonexistent project (P2003)', async () => {
      await expect(
        prisma.projectMember.create({
          data: { project_id: 999999, user_id: outsiderId, role: 'member' },
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
    });

    it('removes memberships when the project is deleted', async () => {
      await addMember({ email: memberUser.email });
      expect(await countMembers()).toBe(2);

      await prisma.project.delete({ where: { id: projectId } });

      expect(await countMembers()).toBe(0);
      expect(await prisma.user.count()).toBe(4);
    });
  });
});
