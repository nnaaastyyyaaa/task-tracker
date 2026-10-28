import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import userRoutes from '../../src/modules/user/userRoutes.js';

describe('user routes', () => {
  let app;
  let userService;
  let checkUser;

  beforeEach(async () => {
    userService = {
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    };

    // Fake auth hook: no Authorization header -> 401, otherwise attaches a session id.
    checkUser = vi.fn(async (request, reply) => {
      if (!request.headers.authorization) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } });
      }
      request.sid = 'session-123';
    });

    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(userRoutes, { userService, checkUser });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('is public: does not call checkUser and returns 201', async () => {
      userService.register.mockResolvedValue({ id: 1, name: 'Alice' });
      const body = {
        name: 'Alice',
        email: 'alice@example.com',
        password: 'password123',
        role: 'team_lead',
      };

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: body,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ data: { id: 1, name: 'Alice' } });
      expect(checkUser).not.toHaveBeenCalled();
      expect(userService.register).toHaveBeenCalledWith(body);
    });
  });

  describe('POST /auth/login', () => {
    it('is public: does not call checkUser, returns 200 and sets the sid cookie', async () => {
      userService.login.mockResolvedValue({
        sid: 'new-session',
        user: { id: 1, name: 'Alice' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'alice@example.com', password: 'password123' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: { id: 1, name: 'Alice' } });
      expect(checkUser).not.toHaveBeenCalled();

      const cookie = [res.headers['set-cookie']].flat().join(';');
      expect(cookie).toContain('sid=new-session');
      expect(cookie).toContain('HttpOnly');
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 401 without authorization and does not call the service', async () => {
      const res = await app.inject({ method: 'POST', url: '/auth/logout' });

      expect(res.statusCode).toBe(401);
      expect(checkUser).toHaveBeenCalledTimes(1);
      expect(userService.logout).not.toHaveBeenCalled();
    });

    it('returns 204, deletes the session and clears the cookie when authorized', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { authorization: 'Bearer test' },
      });

      expect(res.statusCode).toBe(204);
      expect(userService.logout).toHaveBeenCalledWith('session-123');

      const cookie = [res.headers['set-cookie']].flat().join(';');
      expect(cookie).toContain('sid=;');
    });
  });
});
