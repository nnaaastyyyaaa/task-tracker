import { Task } from './entity.js';

export class TaskRepository {
  constructor(db) {
    this.db = db;
  }

  async create(task) {
    const row = { id: ++this.db.seq.tasks, ...task };
    this.db.tasks.set(row.id, row);
    return Task.fromEntity(row);
  }

  async findById(id) {
    const row = this.db.tasks.get(id);
    return row ? Task.fromEntity(row) : null;
  }

  async findByProject(projectId, assigneeId) {
    return [...this.db.tasks.values()]
      .filter((row) => row.project_id === projectId)
      .filter((row) => row.assignee_id === assigneeId)
      .map((row) => Task.fromEntity(row));
  }

  async update(id, fields) {
    const row = this.db.tasks.get(id);
    if (!row) return null;
    Object.assign(row, fields, { updated_at: new Date() });
    return Task.fromEntity(row);
  }

  async updateStatus(id, expectedStatus, newStatus) {
    const row = this.db.tasks.get(id);
    if (!row || row.status !== expectedStatus) return null;
    row.status = newStatus;
    row.updated_at = new Date();
    return Task.fromEntity(row);
  }

  async delete(id) {
    return this.db.tasks.delete(id);
  }
}
