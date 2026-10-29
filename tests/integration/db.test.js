import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma, resetDb } from './helpers/db.js';

describe('test database', () => {
  beforeEach(resetDb);
  afterAll(() => prisma.$disconnect());

  it('starts every test with empty tables', async () => {
    await expect(prisma.user.count()).resolves.toBe(0);
  });
});
