import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserController } from '../../src/modules/user/controller.js';
import { SESSION_TTL } from '../../src/modules/user/service.js';

describe('UserController', () => {
  let userService;
  let controller;
  let request;
  let reply;

  beforeEach(() => {
    userService = {
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    };

    controller = new UserController({ userService });

    request = {
      body: {},
      sid: 'session-123',
    };

    reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setCookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('register', () => {
    it('registers a user and returns status 201', async () => {
      const user = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        role: 'team_lead',
      };

      request.body = {
        name: 'Alice',
        email: 'alice@example.com',
        password: 'secure-password',
        role: 'team_lead',
      };

      userService.register.mockResolvedValue(user);

      await controller.register(request, reply);

      expect(userService.register).toHaveBeenCalledWith(request.body);
      expect(reply.code).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith({ data: user });
    });

    it('does not set a session cookie', async () => {
      userService.register.mockResolvedValue({ id: 1 });

      await controller.register(request, reply);

      expect(reply.setCookie).not.toHaveBeenCalled();
    });

    it('propagates errors thrown by the user service', async () => {
      const error = new Error('Invalid registration data');
      userService.register.mockRejectedValue(error);

      await expect(controller.register(request, reply)).rejects.toBe(error);

      expect(reply.send).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('logs in a user, sets a session cookie and returns user data', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      const user = {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        role: 'team_lead',
      };

      request.body = {
        email: 'alice@example.com',
        password: 'secure-password',
      };

      userService.login.mockResolvedValue({ sid: 'session-123', user });

      await controller.login(request, reply);

      expect(userService.login).toHaveBeenCalledWith(request.body);
      expect(reply.setCookie).toHaveBeenCalledWith('sid', 'session-123', {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
        maxAge: SESSION_TTL / 1000,
      });
      expect(reply.code).toHaveBeenCalledWith(200);
      expect(reply.send).toHaveBeenCalledWith({ data: user });
    });

    it('sets the secure cookie flag in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      userService.login.mockResolvedValue({
        sid: 'secure-session',
        user: { id: 1, name: 'Alice', role: 'team_lead' },
      });

      await controller.login(request, reply);

      expect(reply.setCookie).toHaveBeenCalledWith(
        'sid',
        'secure-session',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
        }),
      );
    });

    it('propagates errors thrown by the user service', async () => {
      const error = new Error('Invalid credentials');
      userService.login.mockRejectedValue(error);

      await expect(controller.login(request, reply)).rejects.toBe(error);

      expect(reply.setCookie).not.toHaveBeenCalled();
      expect(reply.send).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('deletes the session, clears the cookie and returns status 204', async () => {
      await controller.logout(request, reply);

      expect(userService.logout).toHaveBeenCalledWith('session-123');
      expect(reply.clearCookie).toHaveBeenCalledWith('sid', { path: '/' });
      expect(reply.code).toHaveBeenCalledWith(204);
      expect(reply.send).toHaveBeenCalledWith();
    });

    it('propagates errors thrown by the user service', async () => {
      const error = new Error('Session deletion failed');
      userService.logout.mockRejectedValue(error);

      await expect(controller.logout(request, reply)).rejects.toBe(error);

      expect(reply.clearCookie).not.toHaveBeenCalled();
    });
  });
});
