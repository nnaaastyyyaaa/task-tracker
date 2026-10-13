import { User } from './entity.js';

export class UserRepository {
  constructor(db) {
    this.db = db;
  }

  async findByEmail(email) {
    for (const row of this.db.users.values()) {
      if (row.email === email) return User.fromEntity(row);
    }
    return null;
  }

  async findById(id) {
    const row = this.db.users.get(id);
    return row ? User.fromEntity(row) : null;
  }

  async create(user) {
    const row = { id: ++this.db.countUsers, ...user };
    this.db.users.set(row.id, row);
    return User.fromEntity(row);
  }
}
