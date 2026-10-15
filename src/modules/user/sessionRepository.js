import { withRetry } from '../../utils/retry.js';
import { randomBytes } from 'node:crypto';

export class SessionRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create(userId, ttl) {
    const id = randomBytes(32).toString('hex');
    const session = await withRetry(() =>
      this.prisma.session.create({
        data: {
          id,
          user_id: userId,
          expires_at: new Date(Date.now() + ttl),
        },
      }),
    );
    return session ? session.id : null;
  }

  async findValidWithUser(id) {
    const session = await withRetry(() =>
      this.prisma.session.findUnique({ where: { id }, include: { user: true } }),
    );
    if (!session) return null;
    if (session.expires_at <= new Date(Date.now())) {
      await this.delete(id);
      return null;
    }
    return session;
  }

  async findByUserId(userId) {
    const session = await withRetry(() =>
      this.prisma.session.findFirst({ where: { user_id: userId } }),
    );
    if (!session) return null;
    if (session.expires_at <= new Date(Date.now())) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }
    return session;
  }

  async delete(id) {
    await withRetry(() => this.prisma.session.deleteMany({ where: { id } }));
  }

  async deleteExpired() {
    await withRetry(() =>
      this.prisma.session.deleteMany({ where: { expires_at: { lte: new Date() } } }),
    );
  }
}
