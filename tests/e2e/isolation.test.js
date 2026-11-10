import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, resetDb } from '../integration/helpers/db.js';
import {
  addMember,
  createProject,
  createTask,
  makeUser,
  signUp,
  startServer,
} from './helpers/e2e.js';

describe('E2E: isolation between projects and owners', () => {
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
    const leadA = await signUp(server.baseUrl, makeUser('Alpha', 'team_lead'));
    const leadB = await signUp(server.baseUrl, makeUser('Bravo', 'team_lead'));
    const shared = await signUp(server.baseUrl, makeUser('Shared'));

    const projectA = await createProject(leadA.client, {
      name: 'Project A',
      description: '',
    });
    const projectB = await createProject(leadB.client, {
      name: 'Project B',
      description: '',
    });

    await addMember(leadA.client, projectA.id, shared.user.email);
    await addMember(leadB.client, projectB.id, shared.user.email);

    const taskA = await createTask(leadA.client, projectA.id, {
      title: 'Task of A',
      assigneeId: shared.id,
    });
    const taskB = await createTask(leadB.client, projectB.id, {
      title: 'Task of B',
      assigneeId: shared.id,
    });

    return { leadA, leadB, shared, projectA, projectB, taskA, taskB };
  }

  it('shows each owner only their own project and tasks', async () => {
    const { leadA, leadB, projectA, projectB, taskA, taskB } = await setup();

    const listA = await leadA.client.get('/projects');
    const listB = await leadB.client.get('/projects');

    expect(listA.body.data.map((item) => item.id)).toEqual([projectA.id]);
    expect(listB.body.data.map((item) => item.id)).toEqual([projectB.id]);

    const boardA = await leadA.client.get(`/projects/${projectA.id}/tasks`);
    const boardB = await leadB.client.get(`/projects/${projectB.id}/tasks`);

    expect(boardA.body.data.map((item) => item.id)).toEqual([taskA.id]);
    expect(boardB.body.data.map((item) => item.id)).toEqual([taskB.id]);
  });

  it('denies access to a foreign project and its tasks', async () => {
    const { leadA, projectB, taskB } = await setup();

    const project = await leadA.client.get(`/projects/${projectB.id}`);
    const board = await leadA.client.get(`/projects/${projectB.id}/tasks`);
    const task = await leadA.client.get(`/tasks/${taskB.id}`);

    expect(project.status).toBe(403);
    expect(board.status).toBe(403);
    expect(task.status).toBe(403);
  });

  it("does not let an owner change another owner's data", async () => {
    const { leadA, leadB, shared, projectB, taskB } = await setup();

    const invited = await leadA.client.post(`/projects/${projectB.id}/members`, {
      email: makeUser('Alpha').email,
    });
    expect(invited.status).toBe(403);

    const created = await leadA.client.post(`/projects/${projectB.id}/tasks`, {
      title: 'Injected',
      assigneeId: shared.id,
    });
    expect(created.status).toBe(403);

    const edited = await leadA.client.patch(`/tasks/${taskB.id}`, { title: 'Hijacked' });
    const moved = await leadA.client.patch(`/tasks/${taskB.id}/status`, {
      status: 'in_progress',
    });
    const reassigned = await leadA.client.patch(`/tasks/${taskB.id}/assignee`, {
      assigneeId: shared.id,
    });
    const deleted = await leadA.client.del(`/tasks/${taskB.id}`);

    expect(edited.status).toBe(403);
    expect(moved.status).toBe(403);
    expect(reassigned.status).toBe(403);
    expect(deleted.status).toBe(403);

    const after = await leadB.client.get(`/projects/${projectB.id}/tasks`);

    expect(after.body.data).toHaveLength(1);
    expect(after.body.data[0]).toMatchObject({
      id: taskB.id,
      title: 'Task of B',
      status: 'todo',
    });
  });

  it('keeps the “mine” filter scoped to one project for a shared member', async () => {
    const { shared, projectA, projectB, taskA, taskB } = await setup();

    const mineA = await shared.client.get(`/projects/${projectA.id}/tasks?assignee=me`);
    const mineB = await shared.client.get(`/projects/${projectB.id}/tasks?assignee=me`);

    expect(mineA.body.data.map((item) => item.id)).toEqual([taskA.id]);
    expect(mineB.body.data.map((item) => item.id)).toEqual([taskB.id]);

    const projects = await shared.client.get('/projects');

    expect(projects.body.data.map((item) => item.id).sort((a, b) => a - b)).toEqual(
      [projectA.id, projectB.id].sort((a, b) => a - b),
    );
  });

  it('moves a task in one project without touching the same-named task in another', async () => {
    const { leadA, leadB, shared, projectA, projectB } = await setup();

    const twinA = await createTask(leadA.client, projectA.id, {
      title: 'Twin',
      assigneeId: shared.id,
    });
    const twinB = await createTask(leadB.client, projectB.id, {
      title: 'Twin',
      assigneeId: shared.id,
    });

    const moved = await shared.client.patch(`/tasks/${twinA.id}/status`, {
      status: 'in_progress',
    });
    expect(moved.status).toBe(200);

    const otherTwin = await shared.client.get(`/tasks/${twinB.id}`);
    expect(otherTwin.body.data.status).toBe('todo');
  });
});
