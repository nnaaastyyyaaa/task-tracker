export class Project {
  constructor({ id, name, description, ownerId }) {
    this.id = id;
    this.name = name;
    this.ownerId = ownerId;
    this.description = description;
  }

  static fromEntity(row) {
    return new Project({
      id: row.id,
      name: row.name,
      description: row.description,
      ownerId: row.owner_id,
    });
  }

  toEntity() {
    return {
      name: this.name,
      description: this.description,
      owner_id: this.ownerId,
    };
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      ownerId: this.ownerId,
    };
  }
}
