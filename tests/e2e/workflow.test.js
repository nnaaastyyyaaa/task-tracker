import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, resetDb } from '../integration/helpers/db.js';
import {
  addMember,
  byId,
  Client,
  createTask,
  makeUser,
  signUp,
  startServer,
} from './helpers/e2e.js';

describe('E2E: full team workflow', () => {
  let server;

  const leadUser = makeUser('Anastasia', 'team_lead');
  const memberUser = makeUser('Anna', 'team_member');

  beforeAll(async () => {
    server = await startServer();
  });

  beforeEach(resetDb);

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  it('goes from registration to logout', async () => {
    // 1. Реєстрація і вхід team_lead та team_member
    const lead = await signUp(server.baseUrl, leadUser);
    const member = await signUp(server.baseUrl, memberUser);

    // 2. Лідер створює проєкт і стає його власником
    const projectResponse = await lead.client.post('/projects', {
      name: 'Launch',
      description: 'Q4 launch',
    });

    expect(projectResponse.status).toBe(201);

    const project = projectResponse.body.data;

    expect(project).toEqual({
      id: expect.any(Number),
      name: 'Launch',
      description: 'Q4 launch',
      ownerId: lead.id,
    });

    // Учасник проєкту ще не бачить
    const beforeInvite = await member.client.get('/projects');
    expect(beforeInvite.status).toBe(200);
    expect(beforeInvite.body.data).toEqual([]);

    // 3. Додавання учасника за email
    const members = await addMember(lead.client, project.id, memberUser.email);

    expect(members.map((item) => item.id).sort(byId)).toEqual(
      [lead.id, member.id].sort(byId),
    );
    expect(members.find((item) => item.id === member.id)).toMatchObject({
      email: memberUser.email,
      role: 'member',
    });

    const afterInvite = await member.client.get('/projects');
    expect(afterInvite.body.data.map((item) => item.id)).toEqual([project.id]);

    // 4. Створення задач із виконавцями
    const memberTask = await createTask(lead.client, project.id, {
      title: 'Write docs',
      priority: 'high',
      assigneeId: member.id,
    });
    const leadTask = await createTask(lead.client, project.id, {
      title: 'Review docs',
      assigneeId: lead.id,
    });

    expect(memberTask).toMatchObject({
      title: 'Write docs',
      priority: 'high',
      status: 'todo',
      assigneeId: member.id,
      assigneeName: memberUser.name,
    });
    expect(leadTask).toMatchObject({ status: 'todo', assigneeId: lead.id });

    // 5. Виконавець проводить задачу todo -> in_progress -> review -> done
    for (const status of ['in_progress', 'review', 'done']) {
      const moved = await member.client.patch(`/tasks/${memberTask.id}/status`, {
        status,
      });

      expect(moved.status).toBe(200);
      expect(moved.body.data).toMatchObject({ id: memberTask.id, status });

      const fetched = await member.client.get(`/tasks/${memberTask.id}`);
      expect(fetched.body.data.status).toBe(status);
    }

    // 6. Дошка: фільтри «усі» та «лише мої»
    const all = await lead.client.get(`/projects/${project.id}/tasks`);

    expect(all.status).toBe(200);
    expect(all.body.data.map((item) => item.id).sort(byId)).toEqual(
      [memberTask.id, leadTask.id].sort(byId),
    );

    const memberMine = await member.client.get(
      `/projects/${project.id}/tasks?assignee=me`,
    );
    const leadMine = await lead.client.get(`/projects/${project.id}/tasks?assignee=me`);

    expect(memberMine.body.data.map((item) => item.id)).toEqual([memberTask.id]);
    expect(memberMine.body.data[0].status).toBe('done');
    expect(leadMine.body.data.map((item) => item.id)).toEqual([leadTask.id]);

    const badFilter = await lead.client.get(
      `/projects/${project.id}/tasks?assignee=someone`,
    );

    expect(badFilter.status).toBe(400);
    expect(badFilter.body.error.code).toEqual(expect.any(String));

    // 7. Видалення задачі
    const removed = await lead.client.del(`/tasks/${memberTask.id}`);
    expect(removed.status).toBe(204);

    const gone = await lead.client.get(`/tasks/${memberTask.id}`);
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('TASK_NOT_FOUND');

    const remaining = await lead.client.get(`/projects/${project.id}/tasks`);
    expect(remaining.body.data.map((item) => item.id)).toEqual([leadTask.id]);

    // 8. Вихід: сесія видалена, старий sid більше не працює
    const oldSid = lead.client.sid;
    expect(oldSid).toBeTruthy();

    const logout = await lead.client.post('/auth/logout');
    expect(logout.status).toBe(204);
    expect(lead.client.sid).toBeNull();

    const replay = await new Client(server.baseUrl, oldSid).get('/projects');
    expect(replay.status).toBe(401);

    // Сесія учасника не постраждала
    const memberStill = await member.client.get('/projects');
    expect(memberStill.status).toBe(200);
  });
});
