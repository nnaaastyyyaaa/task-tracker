export class ProjectMember {
  constructor({ projectId, userId, role, user = null }) {
    this.projectId = projectId;
    this.userId = userId;
    this.role = role;
    this.user = user;
  }

  static fromEntity(row) {
    return new ProjectMember({
      projectId: row.project_id,
      userId: row.user_id,
      role: row.role,
      user: row.user ?? null,
    });
  }

  toEntity() {
    return { project_id: this.projectId, user_id: this.userId, role: this.role };
  }

  toPublic() {
    return {
      id: this.userId,
      name: this.user?.name ?? null,
      email: this.user?.email ?? null,
      role: this.role,
    };
  }
}
