export class Task {
  constructor({
    id,
    projectId,
    title,
    description,
    assigneeId,
    priority,
    status,
    createdAt,
    updatedAt,
  }) {
    ((this.id = id),
      (this.projectId = projectId),
      (this.title = title),
      (this.description = description),
      (this.assigneeId = assigneeId),
      (this.priority = priority),
      (this.status = status),
      (this.createdAt = createdAt),
      (this.updatedAt = updatedAt));
  }

  toPublic() {
    return {
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      description: this.description,
      assigneeId: this.assigneeId,
      priority: this.priority,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  toEntity() {
    return {
      project_id: this.projectId,
      title: this.title,
      description: this.description,
      assignee_id: this.assigneeId,
      priority: this.priority,
    };
  }

  static fromEntity(row) {
    return {
      id: row.id,
      projectId: row.project_id,
      title: row.title,
      description: row.description,
      assigneeId: row.assignee_id,
      priority: row.priority,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
