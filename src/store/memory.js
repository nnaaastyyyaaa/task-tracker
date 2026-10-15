export class db {
  constructor() {
    ((this.users = new Map()),
      (this.sessions = new Map()),
      (this.projects = new Map()),
      (this.tasks = new Map()),
      (this.members = []),
      (this.seq = { users: 0, projects: 0, tasks: 0 }));
  }
}
