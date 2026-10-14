import bcrypt from 'bcrypt';
import { AppError } from '../../utils/errorHandler.js';
import { User } from './entity.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['team_lead', 'team_member'];
export const SESSION_TTL = 60 * 60 * 1000;

export class UserService {
  constructor(userRepository, sessionRepository) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
  }

  async register({ email, password, name, role } = {}) {
    if (
      [email, password, name, role].some((v) => typeof v !== 'string') ||
      !email ||
      email.trim() === '' ||
      !password ||
      password.trim() === '' ||
      !name ||
      name.trim() === '' ||
      !role ||
      role.trim() === ''
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter all required fields');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const correctEmail = EMAIL_RE.test(normalizedEmail);
    if (!correctEmail) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid email');
    }

    if (password.length < 8) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password too short');
    }
    const passwordHash = await bcrypt.hash(password, 10);

    const validRole = ROLES.includes(role);
    if (!validRole) {
      throw new AppError(400, 'VALIDATION_ERROR', 'User role is invalid');
    }

    const emailExists = await this.userRepository.findByEmail(normalizedEmail);
    if (emailExists) {
      throw new AppError(409, 'EMAIL_TAKEN', 'User with this email already exists');
    }

    const user = new User({
      email: normalizedEmail,
      passwordHash,
      name,
      role,
    }).toEntity();
    const created = await this.userRepository.create(user);
    return created;
  }

  async login({ email, password } = {}) {
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.trim() === '' ||
      password.trim() === ''
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter all required fields');
    }

    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    const prevSid = await this.sessionRepository.findByUserId(user.id);
    if (prevSid) {
      await this.sessionRepository.delete(prevSid.id);
    }
    const sid = await this.sessionRepository.create(user.id, SESSION_TTL);
    return { sid, user };
  }

  async logout(sid) {
    await this.sessionRepository.delete(sid);
  }

  async getBySession(sid) {
    const session = await this.sessionRepository.findValid(sid);
    if (!session) return null;
    const user = await this.userRepository.findById(session.user_id);
    return user ? { id: user.id, name: user.name, role: user.role } : null;
  }

  async findByEmail(email) {
    if (typeof email !== 'string') return null;
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    return user ? user.toPublic() : null;
  }

  async findById(id) {
    const user = await this.userRepository.findById(id);
    return user ? user.toPublic() : null;
  }
}
