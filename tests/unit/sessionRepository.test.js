import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRepository } from '../../src/modules/user/sessionRepository.js';

describe('SessionRepository', () => {
  let prisma;
  let repository;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00.000Z'));

    prisma = {
      session: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    repository = new SessionRepository(prisma);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('create', () => {
    it('creates a session with the correct user ID and expiration time', async () => {
      prisma.session.create.mockImplementation(async ({ data }) => data);

      const now = Date.now();
      const ttl = 60 * 60 * 1000;

      const sid = await repository.create(42, ttl);

      expect(sid).toMatch(/^[a-f0-9]{64}$/);
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          id: sid,
          user_id: 42,
          expires_at: new Date(now + ttl),
        },
      });
    });

    it('generates unique IDs for separate sessions', async () => {
      prisma.session.create.mockImplementation(async ({ data }) => data);

      const sid1 = await repository.create(42, 3600000);
      const sid2 = await repository.create(42, 3600000);

      expect(sid1).not.toBe(sid2);
    });

    it('returns null when the database returns no session', async () => {
      prisma.session.create.mockResolvedValue(null);

      await expect(repository.create(42, 3600000)).resolves.toBeNull();
    });
  });

  describe('findValidWithUser', () => {
    it('returns a session that has not expired, including its user', async () => {
      const session = {
        id: 'valid-session',
        expires_at: new Date(Date.now() + 1000),
        user: { id: 42, name: 'Alice' },
      };

      prisma.session.findUnique.mockResolvedValue(session);

      await expect(repository.findValidWithUser('valid-session')).resolves.toBe(session);

      expect(prisma.session.findUnique).toHaveBeenCalledWith({
        where: { id: 'valid-session' },
        include: { user: true },
      });
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('returns null when the session does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(repository.findValidWithUser('unknown-session')).resolves.toBeNull();

      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes an expired session and returns null', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'expired-session',
        expires_at: new Date(Date.now() - 1000),
        user: { id: 42 },
      });
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(repository.findValidWithUser('expired-session')).resolves.toBeNull();

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'expired-session' },
      });
    });

    it('treats a session as expired when its expiration time equals the current time', async () => {
      prisma.session.findUnique.mockResolvedValue({
        id: 'boundary-session',
        expires_at: new Date(Date.now()),
        user: { id: 42 },
      });
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(repository.findValidWithUser('boundary-session')).resolves.toBeNull();

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'boundary-session' },
      });
    });

    it('treats a session as valid 1 ms before it expires', async () => {
      const session = {
        id: 'almost-expired',
        expires_at: new Date(Date.now() + 1),
        user: { id: 42 },
      };
      prisma.session.findUnique.mockResolvedValue(session);

      await expect(repository.findValidWithUser('almost-expired')).resolves.toBe(session);

      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it('returns a valid session for the specified user', async () => {
      const session = {
        id: 'session-123',
        user_id: 42,
        expires_at: new Date(Date.now() + 60000),
      };
      prisma.session.findFirst.mockResolvedValue(session);

      await expect(repository.findByUserId(42)).resolves.toBe(session);

      expect(prisma.session.findFirst).toHaveBeenCalledWith({
        where: { user_id: 42 },
      });
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('returns null when the user has no session', async () => {
      prisma.session.findFirst.mockResolvedValue(null);

      await expect(repository.findByUserId(42)).resolves.toBeNull();

      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes an expired user session and returns null', async () => {
      prisma.session.findFirst.mockResolvedValue({
        id: 'expired-session',
        user_id: 42,
        expires_at: new Date(Date.now() - 1000),
      });
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(repository.findByUserId(42)).resolves.toBeNull();

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'expired-session' },
      });
    });

    it('treats a user session as expired when its expiration time equals the current time', async () => {
      prisma.session.findFirst.mockResolvedValue({
        id: 'boundary-session',
        user_id: 42,
        expires_at: new Date(Date.now()),
      });
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await expect(repository.findByUserId(42)).resolves.toBeNull();

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'boundary-session' },
      });
    });
  });

  describe('delete', () => {
    it('deletes a session by its ID', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await repository.delete('session-123');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-123' },
      });
    });

    it('does not throw when the session does not exist', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(repository.delete('missing-session')).resolves.toBeUndefined();
    });
  });

  describe('deleteExpired', () => {
    it('deletes all sessions that have expired', async () => {
      const now = new Date(Date.now());
      prisma.session.deleteMany.mockResolvedValue({ count: 3 });

      await repository.deleteExpired();

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { expires_at: { lte: now } },
      });
    });
  });
});
