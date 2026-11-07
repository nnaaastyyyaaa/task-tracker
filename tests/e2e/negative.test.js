import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, resetDb } from '../integration/helpers/db.js';
import {
  addMember,
  byId,
  Client,
  createProject,
  createTask,
  makeUser,
  signUp,
  startServer,
} from './helpers/e2e.js';

describe('E2E: negative scenario', () => {
  let server;

  beforeAll(async () => {
    server = await startServer();
  });

  beforeEach(resetDb);

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  async function setup() {
    const lead = await signUp(server.baseUrl, makeUser('Anastasia', 'team_lead'));
    const member = await signUp(server.baseUrl, makeUser('Anna'));
    const teammate = await signUp(server.baseUrl, makeUser('Olha'));
    const outsider = await signUp(server.baseUrl, makeUser('Stranger'));

    const project = await createProject(lead.client, { name: 'Secret', description: '' });

    await addMember(lead.client, project.id, member.user.email);
    await addMember(lead.client, project.id, teammate.user.email);

    const memberTask = await createTask(lead.client, project.id, {
      title: 'Member task',
      assigneeId: member.id,
    });
    const leadTask = await createTask(lead.client, project.id, {
      title: 'Lead task',
      assigneeId: lead.id,
    });

    return { lead, member, teammate, outsider, project, memberTask, leadTask };
  }

  it('forbids a team member from creating projects, changing assignees and deleting tasks', async () => {
    const { lead, member, teammate, project, memberTask, leadTask } = await setup();

    const createdProject = await member.client.post('/projects', { name: 'Mine' });
    expect(createdProject.status).toBe(403);
    expect(createdProject.body.error.code).toBe('FORBIDDEN');

    const reassigned = await member.client.patch(`/tasks/${memberTask.id}/assignee`, {
      assigneeId: teammate.id,
    });
    expect(reassigned.status).toBe(403);

    const deletedForeign = await member.client.del(`/tasks/${leadTask.id}`);
    expect(deletedForeign.status).toBe(403);

    const deletedOwn = await member.client.del(`/tasks/${memberTask.id}`);
    expect(deletedOwn.status).toBe(403);

    const edited = await member.client.patch(`/tasks/${memberTask.id}`, {
      title: 'Hijacked',
    });
    expect(edited.status).toBe(403);

    const created = await member.client.post(`/projects/${project.id}/tasks`, {
      title: 'Sneaky',
      assigneeId: member.id,
    });
    expect(created.status).toBe(403);

    const invited = await member.client.post(`/projects/${project.id}/members`, {
      email: makeUser('Stranger').email,
    });
    expect(invited.status).toBe(403);

    // Нічого не змінилося
    const board = await lead.client.get(`/projects/${project.id}/tasks`);

    expect(board.status).toBe(200);
    expect(board.body.data.map((item) => item.id).sort(byId)).toEqual(
      [memberTask.id, leadTask.id].sort(byId),
    );

    const stored = board.body.data.find((item) => item.id === memberTask.id);

    expect(stored).toMatchObject({
      title: 'Member task',
      assigneeId: member.id,
      status: 'todo',
    });
    expect(await prisma.project.count()).toBe(1);
  });

  it('lets only the owner or the assignee change the status', async () => {
    const { lead, member, teammate, memberTask } = await setup();

    const byTeammate = await teammate.client.patch(`/tasks/${memberTask.id}/status`, {
      status: 'in_progress',
    });
    expect(byTeammate.status).toBe(403);

    const unchanged = await lead.client.get(`/tasks/${memberTask.id}`);
    expect(unchanged.body.data.status).toBe('todo');

    const byAssignee = await member.client.patch(`/tasks/${memberTask.id}/status`, {
      status: 'in_progress',
    });
    expect(byAssignee.status).toBe(200);

    const byOwner = await lead.client.patch(`/tasks/${memberTask.id}/status`, {
      status: 'review',
    });
    expect(byOwner.status).toBe(200);
  });

  it('rejects non-adjacent status jumps', async () => {
    const { member, memberTask } = await setup();

    const jump = await member.client.patch(`/tasks/${memberTask.id}/status`, {
      status: 'done',
    });
    expect(jump.status).toBe(422);

    const fetched = await member.client.get(`/tasks/${memberTask.id}`);
    expect(fetched.body.data.status).toBe('todo');
  });

  it('hides the project from an outsider', async () => {
    const { outsider, project, memberTask } = await setup();

    const list = await outsider.client.get('/projects');
    expect(list.status).toBe(200);
    expect(list.body.data).toEqual([]);

    const single = await outsider.client.get(`/projects/${project.id}`);
    expect(single.status).toBe(403);
    expect(single.body.error.code).toBe('FORBIDDEN');
    expect(JSON.stringify(single.body)).not.toContain('Secret');

    const board = await outsider.client.get(`/projects/${project.id}/tasks`);
    expect(board.status).toBe(403);

    const task = await outsider.client.get(`/tasks/${memberTask.id}`);
    expect(task.status).toBe(403);
  });

  it('rejects the old sid after logout', async () => {
    const { member, project } = await setup();

    const oldSid = member.client.sid;
    expect(oldSid).toBeTruthy();

    const before = await new Client(server.baseUrl, oldSid).get(
      `/projects/${project.id}`,
    );
    expect(before.status).toBe(200);

    const logout = await member.client.post('/auth/logout');
    expect(logout.status).toBe(204);

    const replayList = await new Client(server.baseUrl, oldSid).get('/projects');
    const replayProject = await new Client(server.baseUrl, oldSid).get(
      `/projects/${project.id}`,
    );

    expect(replayList.status).toBe(401);
    expect(replayProject.status).toBe(401);
    expect(await prisma.session.count()).toBe(3);
  });
});
