import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import bcrypt from 'bcrypt';
import { UserService, SESSION_TTL } from '../../src/modules/user/service.js';
import { User } from '../../src/modules/user/entity.js';

describe('UserService', () => {
  let userRepository;
  let sessionRepository;
  let service;

  const publicUser = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    role: 'team_lead',
  };

  const userWithHash = {
    ...publicUser,
    passwordHash: 'hashed-password',
  };

  const validRegisterBody = {
    name: 'Alice',
    email: 'alice@example.com',
    password: 'password123',
    role: 'team_lead',
  };

  const validLoginBody = {
    email: 'alice@example.com',
    password: 'password123',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    userRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn(),
      create: vi.fn(),
    };

    sessionRepository = {
      findByUserId: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findValidWithUser: vi.fn(),
      deleteExpired: vi.fn(),
    };

    service = new UserService(userRepository, sessionRepository);
  });

  describe('register', () => {
    it('normalizes email, trims name and returns public user data', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({
        toPublic: () => publicUser,
      });

      const result = await service.register({
        name: ' Alice ',
        email: ' Alice@Example.com ',
        password: 'password123',
        role: 'team_lead',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'alice@example.com',
          password_hash: 'hashed-password',
          name: 'Alice',
          role: 'team_lead',
        }),
      );

      expect(result).toEqual(publicUser);
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('password_hash');
    });

    it('does not pass the plain password to the repository', async () => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({ toPublic: () => publicUser });

      await service.register(validRegisterBody);

      const [payload] = userRepository.create.mock.calls[0];
      expect(payload).not.toHaveProperty('password');
      expect(JSON.stringify(payload)).not.toContain('password123');
    });

    it('rejects registration with an already existing email', async () => {
      userRepository.findByEmail.mockResolvedValue(userWithHash);

      await expect(
        service.register({ ...validRegisterBody, email: 'ALICE@example.com' }),
      ).rejects.toMatchObject({
        status: 409,
        code: 'EMAIL_TAKEN',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it.each([
      ['password shorter than 8 characters', { password: 'short' }],
      ['password longer than 72 bytes', { password: 'a'.repeat(73) }],
      ['password of 74 bytes (37 multibyte characters)', { password: 'я'.repeat(37) }],
      ['password is not a string', { password: 12345678 }],
      ['invalid email format', { email: 'invalid-email' }],
      ['email longer than 254 characters', { email: `${'a'.repeat(250)}@b.co` }],
      ['email is not a string', { email: 123 }],
      ['unknown role', { role: 'admin' }],
      ['role is not a string', { role: 1 }],
      ['name shorter than 2 characters', { name: 'A' }],
      ['name longer than 100 characters', { name: 'a'.repeat(101) }],
      ['name is only whitespace', { name: '   ' }],
      ['name is not a string', { name: 42 }],
      ['unknown field in body', { extra: true }],
    ])('rejects request with 400: %s', async (_case, overrides) => {
      const body = { ...validRegisterBody, ...overrides };

      await expect(service.register(body)).rejects.toMatchObject({ status: 400 });

      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it.each(['email', 'password', 'name', 'role'])(
      'rejects request with 400 when %s is missing',
      async (field) => {
        const body = { ...validRegisterBody };
        delete body[field];

        await expect(service.register(body)).rejects.toMatchObject({ status: 400 });

        expect(userRepository.create).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['name of exactly 2 characters', { name: 'Al' }],
      ['name of exactly 100 characters', { name: 'a'.repeat(100) }],
      ['password of exactly 8 characters', { password: 'a'.repeat(8) }],
      ['password of exactly 72 bytes', { password: 'a'.repeat(72) }],
      [
        'password of exactly 72 bytes with multibyte characters',
        { password: 'я'.repeat(36) },
      ],
      ['role team_member', { role: 'team_member' }],
    ])('accepts boundary value: %s', async (_case, overrides) => {
      bcrypt.hash.mockResolvedValue('hashed-password');
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue({ toPublic: () => publicUser });

      await expect(
        service.register({ ...validRegisterBody, ...overrides }),
      ).resolves.toEqual(publicUser);
    });
  });

  describe('login', () => {
    it('rejects unknown email with 401 and does not compare passwords', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'unknown@example.com', password: 'password123' }),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });

      expect(bcrypt.compare).not.toHaveBeenCalled();
      expect(sessionRepository.create).not.toHaveBeenCalled();
    });

    it('rejects wrong password with the same 401 error', async () => {
      userRepository.findByEmail.mockResolvedValue(userWithHash);
      bcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong-password' }),
      ).rejects.toMatchObject({
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid credentials',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hashed-password');
      expect(sessionRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      ['empty email', { email: '' }],
      ['whitespace-only email', { email: '   ' }],
      ['empty password', { password: '' }],
      ['whitespace-only password', { password: '   ' }],
      ['email is not a string', { email: 1 }],
      ['password is not a string', { password: 12345678 }],
      ['unknown field in body', { extra: 1 }],
    ])('rejects request with 400: %s', async (_case, overrides) => {
      await expect(
        service.login({ ...validLoginBody, ...overrides }),
      ).rejects.toMatchObject({ status: 400 });

      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(sessionRepository.create).not.toHaveBeenCalled();
    });

    it.each(['email', 'password'])(
      'rejects request with 400 when %s is missing',
      async (field) => {
        const body = { ...validLoginBody };
        delete body[field];

        await expect(service.login(body)).rejects.toMatchObject({ status: 400 });

        expect(userRepository.findByEmail).not.toHaveBeenCalled();
      },
    );

    it('deletes the previous session and creates a new one', async () => {
      userRepository.findByEmail.mockResolvedValue(userWithHash);
      bcrypt.compare.mockResolvedValue(true);
      sessionRepository.findByUserId.mockResolvedValue({ id: 'old-session-id' });
      sessionRepository.create.mockResolvedValue('new-session-id');

      const result = await service.login({
        email: ' ALICE@EXAMPLE.COM ',
        password: 'password123',
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith('alice@example.com');
      expect(sessionRepository.findByUserId).toHaveBeenCalledWith(1);
      expect(sessionRepository.delete).toHaveBeenCalledWith('old-session-id');
      expect(sessionRepository.create).toHaveBeenCalledWith(1, SESSION_TTL);
      expect(result.sid).toBe('new-session-id');
    });

    it('creates a session without deleting anything when there is no previous session', async () => {
      userRepository.findByEmail.mockResolvedValue(userWithHash);
      bcrypt.compare.mockResolvedValue(true);
      sessionRepository.findByUserId.mockResolvedValue(null);
      sessionRepository.create.mockResolvedValue('new-session-id');

      const result = await service.login(validLoginBody);

      expect(sessionRepository.delete).not.toHaveBeenCalled();
      expect(sessionRepository.create).toHaveBeenCalledWith(1, SESSION_TTL);
      expect(result.sid).toBe('new-session-id');
    });

    it('does not return the password hash', async () => {
      userRepository.findByEmail.mockResolvedValue(userWithHash);
      bcrypt.compare.mockResolvedValue(true);
      sessionRepository.findByUserId.mockResolvedValue(null);
      sessionRepository.create.mockResolvedValue('new-session-id');

      const result = await service.login(validLoginBody);

      expect(result.user).toEqual(publicUser);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('password_hash');
    });
  });

  describe('session methods', () => {
    it('deletes the session on logout', async () => {
      await service.logout('session-id');

      expect(sessionRepository.delete).toHaveBeenCalledWith('session-id');
    });

    it('returns null for an unknown or expired session', async () => {
      sessionRepository.findValidWithUser.mockResolvedValue(null);

      await expect(service.getBySession('invalid-session')).resolves.toBeNull();
      expect(sessionRepository.findValidWithUser).toHaveBeenCalledWith('invalid-session');
    });

    it('returns only id, name and role of the session user', async () => {
      sessionRepository.findValidWithUser.mockResolvedValue({
        user: {
          id: 1,
          name: 'Alice',
          role: 'team_lead',
          password_hash: 'secret-hash',
          email: 'alice@example.com',
        },
      });

      await expect(service.getBySession('valid-session')).resolves.toEqual({
        id: 1,
        name: 'Alice',
        role: 'team_lead',
      });
    });

    it('initiates the cleanup of expired sessions', async () => {
      await service.cleanupSessions();

      expect(sessionRepository.deleteExpired).toHaveBeenCalledTimes(1);
    });
  });

  describe('lookup methods', () => {
    const aliceEntity = new User({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      passwordHash: 'hashed-password',
      role: 'team_lead',
    });

    const bobEntity = new User({
      id: 2,
      name: 'Bob',
      email: 'bob@example.com',
      passwordHash: 'another-hash',
      role: 'team_member',
    });

    describe('findByEmail', () => {
      it('normalizes the email and returns public user data', async () => {
        userRepository.findByEmail.mockResolvedValue(aliceEntity);

        const result = await service.findByEmail('  Alice@Example.com ');

        expect(userRepository.findByEmail).toHaveBeenCalledWith('alice@example.com');
        expect(result).toEqual(publicUser);
        expect(result).not.toHaveProperty('passwordHash');
      });

      it('returns null when the user does not exist', async () => {
        userRepository.findByEmail.mockResolvedValue(null);

        await expect(service.findByEmail('nobody@example.com')).resolves.toBeNull();
      });

      it('returns null without querying the repository when email is not a string', async () => {
        await expect(service.findByEmail(123)).resolves.toBeNull();

        expect(userRepository.findByEmail).not.toHaveBeenCalled();
      });
    });

    describe('findById', () => {
      it('returns public user data', async () => {
        userRepository.findById.mockResolvedValue(aliceEntity);

        const result = await service.findById(1);

        expect(userRepository.findById).toHaveBeenCalledWith(1);
        expect(result).toEqual(publicUser);
        expect(result).not.toHaveProperty('passwordHash');
      });

      it('returns null when the user does not exist', async () => {
        userRepository.findById.mockResolvedValue(null);

        await expect(service.findById(999)).resolves.toBeNull();
      });
    });

    describe('findByIds', () => {
      it('returns public data for every found user', async () => {
        userRepository.findByIds.mockResolvedValue([aliceEntity, bobEntity]);

        const result = await service.findByIds([1, 2]);

        expect(userRepository.findByIds).toHaveBeenCalledWith([1, 2]);
        expect(result).toEqual([
          publicUser,
          { id: 2, name: 'Bob', email: 'bob@example.com', role: 'team_member' },
        ]);
        result.forEach((u) => expect(u).not.toHaveProperty('passwordHash'));
      });

      it('returns an empty array without querying the repository for an empty list', async () => {
        await expect(service.findByIds([])).resolves.toEqual([]);

        expect(userRepository.findByIds).not.toHaveBeenCalled();
      });
    });
  });
});
