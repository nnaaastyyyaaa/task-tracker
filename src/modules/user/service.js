import bcrypt from 'bcrypt';
import { Buffer } from 'node:buffer';
import { AppError } from '../../utils/errorHandler.js';
import { badRequest, checkBody, str } from '../../utils/validation.js';
import { User } from './entity.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ROLES = ['team_lead', 'team_member'];
export const SESSION_TTL = 60 * 60 * 1000;

const normalizeEmail = (email) => email.trim().toLowerCase();

export class UserService {
  constructor(userRepository, sessionRepository) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
  }

  async register(body) {
    checkBody(body, ['email', 'password', 'name', 'role']);

    const name = str(body.name, 'name', { min: 2, max: 100 });

    if (typeof body.email !== 'string') throw badRequest('email: must be a string');
    const email = normalizeEmail(body.email);
    if (email.length > 254 || !EMAIL_RE.test(email)) throw badRequest('Invalid email');

    if (
      typeof body.password !== 'string' ||
      body.password.length < 8 ||
      Buffer.byteLength(body.password) > 72
    ) {
      throw badRequest('Password must be 8-72 characters');
    }

    const validRole = ROLES.includes(body.role);
    if (!validRole) {
      throw new AppError(400, 'VALIDATION_ERROR', 'User role is invalid');
    }

    const emailExists = await this.userRepository.findByEmail(email);
    if (emailExists) {
      throw new AppError(409, 'EMAIL_TAKEN', 'User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const user = new User({
      email,
      passwordHash,
      name,
      role: body.role,
    }).toEntity();
    const created = await this.userRepository.create(user);
    return created.toPublic();
  }

  async login(body) {
    checkBody(body, ['email', 'password']);

    if (
      typeof body.email !== 'string' ||
      typeof body.password !== 'string' ||
      body.email.trim() === '' ||
      body.password.trim() === ''
    ) {
      throw badRequest('Enter email and password');
    }

    const email = normalizeEmail(body.email);

    const user = await this.userRepository.findByEmail(email);
    const ok = user && (await bcrypt.compare(body.password, user.passwordHash));
    if (!ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');

    const prevSid = await this.sessionRepository.findByUserId(user.id);
    if (prevSid) {
      await this.sessionRepository.delete(prevSid.id);
    }
    const sid = await this.sessionRepository.create(user.id, SESSION_TTL);
    return {
      sid,
      user: new User(user).toPublic(),
    };
  }

  async logout(sid) {
    await this.sessionRepository.delete(sid);
  }

  async getBySession(sid) {
    const session = await this.sessionRepository.findValidWithUser(sid);
    if (!session) return null;
    const { id, name, role } = session.user;
    return { id, name, role };
  }

  async findByEmail(email) {
    if (typeof email !== 'string') return null;
    const normalized = normalizeEmail(email);
    const user = await this.userRepository.findByEmail(normalized);
    return user ? user.toPublic() : null;
  }

  async findById(id) {
    const user = await this.userRepository.findById(id);
    return user ? user.toPublic() : null;
  }

  async findByIds(ids) {
    if (ids.length === 0) return [];
    const users = await this.userRepository.findByIds(ids);
    return users.map((u) => u.toPublic());
  }

  async cleanupSessions() {
    await this.sessionRepository.deleteExpired();
  }
}
