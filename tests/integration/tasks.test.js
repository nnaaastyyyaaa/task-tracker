import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { prisma, resetDb } from './helpers/db.js';
import { buildTestApp } from './helpers/app.js';

describe('Tasks API', () => {
  let app;

  const firstUser = {
    name: 'Anastasia',
    email: 'email@gmail.com',
    password: 'password123',
    role: 'team_lead',
  };

  const secondUser = {
    name: 'Anna',
    email: 'anna@gmail.com',
    password: 'password123',
    role: 'team_member',
  };

  const thirdUser = {
    name: 'Nastya',
    email: 'nastya@gmail.com',
    password: 'password123',
    role: 'team_member',
  };

  const project = {
    name: 'test',
    description: 'test',
  };

  let assigneeId;
  const task = {
    title: 'test',
    description: 'test',
    priority: 'high',
  };

  async function loginAndGetCookie(data) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: data,
    });

    const setCookie = response.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

    const sidCookie = cookies.find((cookie) => /^sid=/i.test(cookie));

    return sidCookie?.split(';')[0];
  }

  beforeAll(async () => {
    app = await buildTestApp();
  });

  let projectId;

  beforeEach(async () => {
    await resetDb();

    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: firstUser,
    });

    const secondCreated = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: secondUser,
    });

    const secondCreatedData = secondCreated.json();
    assigneeId = secondCreatedData.data.id;

    let cookie = await loginAndGetCookie({
      email: 'email@gmail.com',
      password: 'password123',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: project,
      headers: { cookie },
    });

    const data = await response.json();
    projectId = data.data.id;

    await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/members`,
      payload: {
        email: secondUser.email,
      },
      headers: { cookie },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /projects/:id/tasks', () => {
    it('creates a task with valid data', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(201);

      const taskData = await response.json();

      const fromDb = await prisma.task.findUnique({
        where: { id: taskData.data.id },
      });

      expect(fromDb).toMatchObject({
        title: task.title,
        description: task.description,
        priority: task.priority,
        assignee_id: assigneeId,
        project_id: projectId,
      });
    });

    it('returns an error when a required field is missing', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('returns an error when status or priority is invalid', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      let response = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { title: 'test', description: 'test', priority: 'test' },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');

      response = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { title: 'test', description: 'test', status: 'test' },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('returns an error when a related entity does not exist', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/projects/10/tasks`,
        payload: {
          title: 'test',
          description: 'test',
          priority: 'medium',
          assigneeId,
        },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('PROJECT_NOT_FOUND');
    });
  });

  describe('GET /projects/:id/tasks', () => {
    it('returns a list of tasks', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const firstResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      const secondResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      expect(firstResponse.statusCode).toBe(201);
      expect(secondResponse.statusCode).toBe(201);

      const response = await app.inject({
        method: 'GET',
        url: `/projects/${projectId}/tasks`,
        headers: { cookie },
      });

      const data = await response.json();
      expect(data.data.length).toBe(2);
    });

    it('filters, sorts or paginates tasks', async () => {
      const newUser = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: thirdUser,
      });

      const thirdUserData = await newUser.json();

      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/members`,
        payload: {
          email: thirdUser.email,
        },
        headers: { cookie },
      });

      const firstResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      const secondResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      const thirdResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId: thirdUserData.data.id },
        headers: { cookie },
      });

      expect(firstResponse.statusCode).toBe(201);
      expect(secondResponse.statusCode).toBe(201);
      expect(thirdResponse.statusCode).toBe(201);

      const newCookie = await loginAndGetCookie({
        email: 'nastya@gmail.com',
        password: 'password123',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/projects/${projectId}/tasks?assignee=me`,
        headers: { cookie: newCookie },
      });

      const data = await response.json();
      expect(data.data.length).toBe(1);
    });
  });

  describe('GET /tasks/:taskId', () => {
    it('returns a task by ID', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const response = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      const data = await response.json();

      expect(response.statusCode).toBe(201);

      const taskRes = await app.inject({
        method: 'GET',
        url: `/tasks/${data.data.id}`,
        headers: { cookie },
      });

      const taskData = taskRes.json();

      expect(taskRes.statusCode).toBe(200);
      expect(taskData.data).toMatchObject({
        ...task,
        assigneeId,
      });
    });

    it('returns an error when the task does not exist', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const taskRes = await app.inject({
        method: 'GET',
        url: `/tasks/101`,
        headers: { cookie },
      });

      expect(taskRes.statusCode).toBe(404);
      expect(taskRes.json().error.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('PATCH /tasks/:taskId', () => {
    it('updates a task with valid data', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      expect(createResponse.statusCode).toBe(201);
      const createdTask = createResponse.json().data;

      const updatedData = {
        title: 'Updated task',
        description: 'Updated description',
      };

      const response = await app.inject({
        method: 'PATCH',
        url: `/tasks/${createdTask.id}`,
        payload: updatedData,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        id: createdTask.id,
        ...updatedData,
        priority: task.priority,
        assigneeId,
      });

      const fromDb = await prisma.task.findUnique({
        where: { id: createdTask.id },
      });

      expect(fromDb).toMatchObject({
        title: updatedData.title,
        description: updatedData.description,
        priority: task.priority,
        assignee_id: assigneeId,
        project_id: projectId,
      });
    });

    it('updates task status', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      expect(createResponse.statusCode).toBe(201);
      const createdTask = createResponse.json().data;

      const response = await app.inject({
        method: 'PATCH',
        url: `/tasks/${createdTask.id}/status`,
        payload: { status: 'in_progress' },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        id: createdTask.id,
        status: 'in_progress',
      });

      const fromDb = await prisma.task.findUnique({
        where: { id: createdTask.id },
      });

      expect(fromDb.status).toBe('in_progress');
    });

    it('returns an error when updating a nonexistent task', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const response = await app.inject({
        method: 'PATCH',
        url: '/tasks/999999',
        payload: { title: 'Updated task' },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('TASK_NOT_FOUND');
    });

    it('returns an error when update data is invalid', async () => {
      const cookie = await loginAndGetCookie({
        email: 'email@gmail.com',
        password: 'password123',
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      expect(createResponse.statusCode).toBe(201);
      const createdTask = createResponse.json().data;

      const response = await app.inject({
        method: 'PATCH',
        url: `/tasks/${createdTask.id}`,
        payload: { title: 'A' },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
    });

    it('changes task assignee successfully', async () => {
      const cookie = await loginAndGetCookie({
        email: firstUser.email,
        password: firstUser.password,
      });

      const thirdUserResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: thirdUser,
      });

      expect(thirdUserResponse.statusCode).toBe(201);

      const thirdUserId = thirdUserResponse.json().data.id;

      const memberResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/members`,
        payload: { email: thirdUser.email },
        headers: { cookie },
      });

      expect(memberResponse.statusCode).toBe(201);
      const createResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      expect(createResponse.statusCode).toBe(201);
      const createdTask = createResponse.json().data;

      const response = await app.inject({
        method: 'PATCH',
        url: `/tasks/${createdTask.id}/assignee`,
        payload: { assigneeId: thirdUserId },
        headers: { cookie },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data).toMatchObject({
        id: createdTask.id,
        assigneeId: thirdUserId,
        assigneeName: thirdUser.name,
      });

      const fromDb = await prisma.task.findUnique({
        where: { id: createdTask.id },
      });

      expect(fromDb.assignee_id).toBe(thirdUserId);
    });
  });

  describe('DELETE /tasks/:taskId', () => {
    it('deletes a task successfully', async () => {
      const cookie = await loginAndGetCookie({
        email: firstUser.email,
        password: firstUser.password,
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: `/projects/${projectId}/tasks`,
        payload: { ...task, assigneeId },
        headers: { cookie },
      });

      expect(createResponse.statusCode).toBe(201);
      const createdTask = createResponse.json().data;

      const response = await app.inject({
        method: 'DELETE',
        url: `/tasks/${createdTask.id}`,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(204);

      const fromDb = await prisma.task.findUnique({
        where: { id: createdTask.id },
      });

      expect(fromDb).toBeNull();
    });

    it('returns an error when deleting a nonexistent task', async () => {
      const cookie = await loginAndGetCookie({
        email: firstUser.email,
        password: firstUser.password,
      });

      const response = await app.inject({
        method: 'DELETE',
        url: '/tasks/999999',
        headers: { cookie },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('TASK_NOT_FOUND');
    });
  });
});
