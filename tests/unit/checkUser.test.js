import { describe, it, expect, vi } from 'vitest';
import { createCheckUser } from '../../src/utils/checkUser';

describe('checkUser', () => {
  it('find user on session cookie and add it to request', async () => {
    const user = { id: 1, name: 'Test User' };
    const userService = {
      getBySession: vi.fn().mockResolvedValue(user),
    };
    const checkUser = createCheckUser(userService);
    const request = {
      cookies: { sid: 'session123' },
    };

    await checkUser(request);

    expect(userService.getBySession).toHaveBeenCalledWith('session123');
    expect(request.user).toBe(user);
    expect(request.sid).toBe('session123');
  });

  it('throw error 401, if cookie is absent', async () => {
    const userService = {
      getBySession: vi.fn(),
    };
    const checkUser = createCheckUser(userService);
    const request = {
      cookies: {},
    };

    await expect(checkUser(request)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });

    expect(userService.getBySession).not.toHaveBeenCalled();
  });

  it('throw error 401, if the session does not correspond to the user', async () => {
    const userService = {
      getBySession: vi.fn().mockResolvedValue(null),
    };
    const checkUser = createCheckUser(userService);
    const request = {
      cookies: { sid: 'invalid-session' },
    };

    await expect(checkUser(request)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    });

    expect(userService.getBySession).toHaveBeenCalledWith('invalid-session');
  });
});
