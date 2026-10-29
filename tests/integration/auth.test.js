import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db.js';
import { buildTestApp } from './helpers/app.js';

describe('Authentication API', () => {
  beforeEach(resetDb);

  let app;
  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(() => prisma.$disconnect());

  describe('POST /auth/register', () => {
    it('creates a user with valid data', async () => {
      const user = {
        name: 'Anastasia',
        email: 'email@gmail.com',
        password: 'password123',
        role: 'team_lead',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });

      expect(response.statusCode).toBe(201);
      expect(response.body).toBeDefined();

      const createdUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      expect(createdUser).not.toBeNull();
      expect(createdUser.password_hash).not.toBe(user.password);
    });

    it('throw error when trying to register with already existing in db email', async () => {
      const user = {
        name: 'Anastasia',
        email: 'email@gmail.com',
        password: 'password123',
        role: 'team_lead',
      };

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });
      const data = await response.json();

      expect(response.statusCode).toBe(409);
      expect(data.error.code).toBe('EMAIL_TAKEN');
    });

    it('throw error if email invalid or absent', async () => {
      const user = {
        name: 'Anastasia',
        password: 'password123',
        role: 'team_lead',
      };

      let response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });

      console.log(response);
      let data = await response.json();

      expect(response.statusCode).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');

      response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          ...user,
          email: 'abcde',
        },
      });
      data = await response.json();

      expect(response.statusCode).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('throw error if password invalid or absent', async () => {
      const user = {
        name: 'Anastasia',
        email: 'email@gmail.com',
        role: 'team_lead',
      };

      let response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });

      let data = await response.json();

      expect(response.statusCode).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');

      response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          ...user,
          password: '12345',
        },
      });
      data = await response.json();

      expect(response.statusCode).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });

    it('throw error if no name', async () => {
      const user = {
        email: 'email@gmail.com',
        password: 'password123',
        role: 'team_lead',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });

      const data = await response.json();

      expect(response.statusCode).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      const user = {
        name: 'Anastasia',
        email: 'email@gmail.com',
        password: 'password123',
        role: 'team_lead',
      };

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });
    });

    it('sets sid to cookies when login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'email@gmail.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const cookieHeader = Array.isArray(cookies) ? cookies.join('; ') : cookies;

      expect(cookieHeader).toMatch(/(?:^|,\s*)sid=/i);
      expect(cookieHeader).toMatch(/HttpOnly/i);
      expect(cookieHeader).toMatch(/SameSite=Lax/i);
    });

    it('throw error if invalid or absent password', async () => {
      let response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'email@gmail.com',
        },
      });

      let data = response.json();
      expect(response.statusCode).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');

      response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'email@gmail.com',
          password: 'password12',
        },
      });

      data = response.json();
      expect(response.statusCode).toBe(401);
      expect(data.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('throw error if invalid or absent email', async () => {
      let response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          password: 'password123',
        },
      });

      let data = response.json();
      expect(response.statusCode).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');

      response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'mail@gmail.com',
          password: 'password123',
        },
      });

      data = response.json();
      expect(response.statusCode).toBe(401);
      expect(data.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('does not create a session with an incorrect password', async () => {
      const sessionsBefore = await prisma.session.count();

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'email@gmail.com',
          password: 'wrong-password',
        },
      });

      expect(response.statusCode).toBe(401);

      const sessionsAfter = await prisma.session.count();

      expect(sessionsAfter).toBe(sessionsBefore);
    });
  });

  describe('Session and cookie', () => {
    beforeEach(async () => {
      const user = {
        name: 'Anastasia',
        email: 'email@gmail.com',
        password: 'password123',
        role: 'team_lead',
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });

      expect(response.statusCode).toBe(201);
    });

    it('sets sid cookie with correct attributes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'email@gmail.com',
          password: 'password123',
        },
      });

      expect(response.statusCode).toBe(200);

      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

      const sidCookie = cookies.find((cookie) => /^sid=/i.test(cookie));

      expect(sidCookie).toBeDefined();
      expect(sidCookie).toMatch(/HttpOnly/i);
      expect(sidCookie).toMatch(/SameSite=Lax/i);
      expect(sidCookie).toMatch(/Max-Age=\d+/i);
    });

    it('rejects request without cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
      });

      expect(response.statusCode).toBe(404);
    });

    it('rejects invalid session cookie', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: {
          cookie: 'sid=invalid-session',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /auth/logout', () => {
    beforeEach(async () => {
      const user = {
        name: 'Anastasia',
        email: 'email@gmail.com',
        password: 'password123',
        role: 'team_lead',
      };

      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: user,
      });
    });

    async function loginAndGetCookie() {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'email@gmail.com',
          password: 'password123',
        },
      });

      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

      const sidCookie = cookies.find((cookie) => /^sid=/i.test(cookie));

      return sidCookie?.split(';')[0];
    }

    it('logs out and invalidates the session', async () => {
      const cookie = await loginAndGetCookie();

      expect(cookie).toBeDefined();

      const logoutResponse = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie },
      });

      expect(logoutResponse.statusCode).toBe(204);

      const protectedResponse = await app.inject({
        method: 'GET',
        url: '/auth/me',
        headers: { cookie },
      });

      expect(protectedResponse.statusCode).toBe(404);
    });

    it('clears sid cookie on logout', async () => {
      const cookie = await loginAndGetCookie();

      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { cookie },
      });

      const setCookie = response.headers['set-cookie'];
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];

      const clearedSid = cookies.find((value) => /^sid=/i.test(value));

      expect(clearedSid).toBeDefined();
      expect(clearedSid).toMatch(/Max-Age=0/i);
    });

    it('handles logout without a session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      console.log(response);

      expect(response.statusCode).toBe(401);
    });
  });
});
