import { randomBytes } from 'node:crypto';

export class SessionRepository {
  constructor(db) {
    this.db = db;
  }

  async create(userId, ttl) {
    const id = randomBytes(32).toString('hex');
    this.db.sessions.set(id, { id, user_id: userId, expires_at: Date.now() + ttl });
    return id;
  }

  async findValid(id) {
    const s = this.db.sessions.get(id);
    if (!s) return null;
    if (s.expires_at <= Date.now()) {
      this.db.sessions.delete(id);
      return null;
    }
    return s;
  }

  async delete(id) {
    this.db.sessions.delete(id);
  }
}
