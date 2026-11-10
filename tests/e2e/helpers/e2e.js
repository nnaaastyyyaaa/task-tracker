import { expect } from 'vitest';
import { app } from '../../../src/app.js';

export async function startServer() {
  const fastify = app({ logger: false });
  await fastify.listen({ port: 0, host: '127.0.0.1' });

  const { port } = fastify.server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => fastify.close(),
  };
}

export class Client {
  constructor(baseUrl, sid = null) {
    this.baseUrl = baseUrl;
    this.sid = sid;
  }

  async request(method, path, body) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (this.sid) headers.cookie = this.sid;

    const response = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const sidCookie = response.headers
      .getSetCookie()
      .find((value) => /^sid=/i.test(value));

    if (sidCookie) {
      const cleared = /Max-Age=0/i.test(sidCookie) || /^sid=;/i.test(sidCookie);
      this.sid = cleared ? null : sidCookie.split(';')[0];
    }

    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { status: response.status, body: json, headers: response.headers };
  }

  get = (path) => this.request('GET', path);
  post = (path, body) => this.request('POST', path, body);
  patch = (path, body) => this.request('PATCH', path, body);
  del = (path) => this.request('DELETE', path);
}

export function makeUser(name, role = 'team_member') {
  return {
    name,
    email: `${name.toLowerCase()}@example.com`,
    password: 'password123',
    role,
  };
}

export async function signUp(baseUrl, user) {
  const client = new Client(baseUrl);

  const registered = await client.post('/auth/register', user);
  expect(registered.status).toBe(201);

  const loggedIn = await client.post('/auth/login', {
    email: user.email,
    password: user.password,
  });
  expect(loggedIn.status).toBe(200);
  expect(client.sid).toMatch(/^sid=/);

  return { client, id: registered.body.data.id, user };
}

export async function createProject(client, body = { name: 'Project', description: '' }) {
  const response = await client.post('/projects', body);
  expect(response.status).toBe(201);

  return response.body.data;
}

export async function addMember(client, projectId, email) {
  const response = await client.post(`/projects/${projectId}/members`, {
    email,
  });
  expect(response.status).toBe(201);

  return response.body.data;
}

export async function createTask(client, projectId, body) {
  const response = await client.post(`/projects/${projectId}/tasks`, {
    description: '',
    priority: 'medium',
    ...body,
  });
  expect(response.status).toBe(201);

  return response.body.data;
}

export const byId = (a, b) => a - b;
