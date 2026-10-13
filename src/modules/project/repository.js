import { Project } from './entity.js';

export class ProjectRepository {
  constructor(db) {
    this.db = db;
  }

  async findById(id) {
    const row = this.db.projects.get(id);
    return row ? Project.fromEntity(row) : null;
  }

  async findByIds(ids) {
    return ids
      .map((id) => this.db.projects.get(id))
      .filter(Boolean)
      .map((row) => Project.fromEntity(row))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async create(project) {
    const row = { id: ++this.db.seq.projects, ...project };
    this.db.projects.set(row.id, row);
    return Project.fromEntity(row);
  }

  #toMember(row) {
    return { projectId: row.project_id, userId: row.user_id, role: row.role };
  }

  async addMember(projectId, userId, role) {
    this.db.members.push({ project_id: projectId, user_id: userId, role });
  }

  async findMember(projectId, userId) {
    const row = this.db.members.find(
      (m) => m.project_id === projectId && m.user_id === userId,
    );
    return row ? this.#toMember(row) : null;
  }

  async listMembers(projectId) {
    return this.db.members
      .filter((m) => m.project_id === projectId)
      .map((r) => this.#toMember(r));
  }

  async listMembershipsOf(userId) {
    return this.db.members
      .filter((m) => m.user_id === userId)
      .map((r) => this.#toMember(r));
  }
}
