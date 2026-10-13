export class Session {
  constructor({ id, userId, expiresAt }) {
    this.id = id;
    this.expiresAt = expiresAt;
    this.puserId = userId;
  }

  fromEntity(row) {
    return new User({
      id: row.id,
      userId: row.userId,
      expiresAt: row.expiresAt,
    });
  }
  toEntity() {
    return {
      user_id: this.userId,
      expires_at: this.expiresAt,
    };
  }
}
