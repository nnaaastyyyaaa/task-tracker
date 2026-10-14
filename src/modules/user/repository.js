import { withRetry } from '../../utils/retry.js';
import { AppError } from '../../utils/errorHandler.js';
import { User } from './entity.js';

export class UserRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async findByEmail(email) {
    const user = await withRetry(() => this.prisma.User.findUnique({ where: { email } }));
    return user ? User.fromEntity(user) : null;
  }

  async findById(id) {
    const user = await withRetry(() => this.prisma.User.findUnique({ where: { id } }));
    return user ? User.fromEntity(user) : null;
  }

  async create(user) {
    try {
      const created = await this.prisma.User.create({ data: user });
      return created ? User.fromEntity(created) : null;
    } catch (e) {
      if (e.code === 'P2002') {
        throw new AppError(409, 'EMAIL_TAKEN', 'User with this email already exists');
      }
      throw e;
    }
  }
}
