import { randomBytes } from 'node:crypto';

export class SessionRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async create(userId, ttl) {
    const id = randomBytes(32).toString('hex');
    const session = await this.prisma.Session.create({
      data: {
        id,
        user_id: userId,
        expires_at: new Date(Date.now() + ttl),
      },
    });
    return session ? session.id : null;
  }

  async findValid(id) {
    const session = await this.prisma.Session.findUnique({ where: { id } });
    if (!session) return null;
    if (session.expires_at <= new Date(Date.now())) {
      this.prisma.Session.deleteMany({ where: { id } });
      return null;
    }
    return session;
  }

  async findByUserId(userId) {
    const session = await this.prisma.Session.findFirst({ where: { user_id: userId } });
    if (!session) return null;
    if (session.expires_at <= new Date(Date.now())) {
      this.prisma.Session.deleteMany({ where: { id: userId } });
      return null;
    }
    return session;
  }

  async delete(id) {
    await this.prisma.session.deleteMany({ where: { id } });
  }
}
