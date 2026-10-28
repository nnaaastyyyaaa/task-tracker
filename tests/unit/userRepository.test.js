import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRepository } from '../../src/modules/user/repository.js';

describe('UserRepository', () => {
  let prisma;
  let repository;

  const userRow = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    password_hash: 'hashed-password',
    role: 'team_lead',
  };

  const secondRow = {
    id: 2,
    name: 'Bob',
    email: 'bob@example.com',
    password_hash: 'another-hash',
    role: 'team_member',
  };

  const alicePublic = {
    id: 1,
    name: 'Alice',
    email: 'alice@example.com',
    role: 'team_lead',
  };

  const bobPublic = {
    id: 2,
    name: 'Bob',
    email: 'bob@example.com',
    role: 'team_member',
  };

  beforeEach(() => {
    prisma = {
      User: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };

    repository = new UserRepository(prisma);
  });

  describe('findByEmail', () => {
    it('returns a User entity when the email exists', async () => {
      prisma.User.findUnique.mockResolvedValue(userRow);

      const result = await repository.findByEmail('alice@example.com');

      expect(prisma.User.findUnique).toHaveBeenCalledWith({
        where: { email: 'alice@example.com' },
      });
      expect(result.passwordHash).toBe('hashed-password');
      expect(result.toPublic()).toEqual(alicePublic);
    });

    it('returns null when the email does not exist', async () => {
      prisma.User.findUnique.mockResolvedValue(null);

      await expect(repository.findByEmail('unknown@example.com')).resolves.toBeNull();
    });

    it('does not retry a permanent database error', async () => {
      const error = new Error('Syntax error');
      prisma.User.findUnique.mockRejectedValue(error);

      await expect(repository.findByEmail('alice@example.com')).rejects.toBe(error);

      expect(prisma.User.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('returns a User entity when the ID exists', async () => {
      prisma.User.findUnique.mockResolvedValue(userRow);

      const result = await repository.findById(1);

      expect(prisma.User.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result.toPublic()).toEqual(alicePublic);
    });

    it('returns null when the ID does not exist', async () => {
      prisma.User.findUnique.mockResolvedValue(null);

      await expect(repository.findById(999)).resolves.toBeNull();
    });
  });

  describe('findByIds', () => {
    it('returns User entities for the requested IDs', async () => {
      prisma.User.findMany.mockResolvedValue([userRow, secondRow]);

      const result = await repository.findByIds([1, 2]);

      expect(prisma.User.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
      });
      expect(result.map((user) => user.toPublic())).toEqual([alicePublic, bobPublic]);
    });

    it('returns an empty array when no users are found', async () => {
      prisma.User.findMany.mockResolvedValue([]);

      await expect(repository.findByIds([10, 20])).resolves.toEqual([]);
    });
  });

  describe('create', () => {
    const newUser = {
      name: 'Alice',
      email: 'alice@example.com',
      password_hash: 'hashed-password',
      role: 'team_lead',
    };

    it('creates a user and returns a User entity', async () => {
      prisma.User.create.mockResolvedValue({ id: 1, ...newUser });

      const result = await repository.create(newUser);

      expect(prisma.User.create).toHaveBeenCalledWith({ data: newUser });
      expect(result.toPublic()).toEqual(alicePublic);
      expect(result.toPublic()).not.toHaveProperty('passwordHash');
    });

    it('throws a conflict error when the email already exists', async () => {
      const duplicateError = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
      });
      prisma.User.create.mockRejectedValue(duplicateError);

      await expect(repository.create(newUser)).rejects.toMatchObject({
        status: 409,
        code: 'EMAIL_TAKEN',
        message: 'User with this email already exists',
      });
    });

    it('propagates unexpected database errors', async () => {
      const databaseError = new Error('Database connection failed');
      prisma.User.create.mockRejectedValue(databaseError);

      await expect(repository.create(newUser)).rejects.toBe(databaseError);
    });

    it('does not retry on failure, to avoid duplicate inserts', async () => {
      prisma.User.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(repository.create(newUser)).rejects.toThrow();

      expect(prisma.User.create).toHaveBeenCalledTimes(1);
    });
  });
});
