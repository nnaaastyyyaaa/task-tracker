export class User {
  constructor({ id, name, email, passwordHash, role }) {
    this.id = id;
    this.name = name;
    this.passwordHash = passwordHash;
    this.email = email;
    this.role = role;
  }

  static fromEntity(row) {
    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
    });
  }
  toEntity() {
    return {
      name: this.name,
      password_hash: this.passwordHash,
      email: this.email,
      role: this.role,
    };
  }
  toPublic() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
    };
  }
}
