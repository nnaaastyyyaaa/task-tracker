import { describe, expect, it } from 'vitest';

import { Project } from '../../src/modules/project/entity.js';
import { ProjectMember } from '../../src/modules/projectMember/entity.js';
import { Task } from '../../src/modules/task/entity.js';
import { User } from '../../src/modules/user/entity.js';

// Для форми об'єктів скрізь toStrictEqual: він ловить зайві й зниклі поля,
// тому витік чутливих даних або втрата поля одразу валить тест.

describe('User entity', () => {
  const row = {
    id: 7,
    name: 'Anna',
    email: 'anna@example.com',
    password_hash: '$2b$10$hash',
    role: 'team_lead',
  };

  describe('constructor', () => {
    it('stores every field', () => {
      const user = new User({
        id: 7,
        name: 'Anna',
        email: 'anna@example.com',
        passwordHash: '$2b$10$hash',
        role: 'team_lead',
      });

      expect(user.id).toBe(7);
      expect(user.name).toBe('Anna');
      expect(user.email).toBe('anna@example.com');
      expect(user.passwordHash).toBe('$2b$10$hash');
      expect(user.role).toBe('team_lead');
    });

    it('leaves the id undefined for a new user', () => {
      const user = new User({
        name: 'Anna',
        email: 'a@b.c',
        passwordHash: 'h',
        role: 'team_member',
      });

      expect(user.id).toBe(undefined);
    });
  });

  describe('fromEntity', () => {
    it('maps snake_case columns to camelCase fields', () => {
      const user = User.fromEntity(row);

      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(7);
      expect(user.name).toBe('Anna');
      expect(user.email).toBe('anna@example.com');
      expect(user.passwordHash).toBe('$2b$10$hash');
      expect(user.role).toBe('team_lead');
    });
  });

  describe('toEntity', () => {
    it('returns the database shape without the id', () => {
      expect(User.fromEntity(row).toEntity()).toStrictEqual({
        name: 'Anna',
        password_hash: '$2b$10$hash',
        email: 'anna@example.com',
        role: 'team_lead',
      });
    });
  });

  describe('toPublic', () => {
    it('returns only id, name, email and role', () => {
      expect(User.fromEntity(row).toPublic()).toStrictEqual({
        id: 7,
        name: 'Anna',
        email: 'anna@example.com',
        role: 'team_lead',
      });
    });

    it('never exposes the password hash', () => {
      const text = JSON.stringify(User.fromEntity(row).toPublic());

      expect(text.includes('$2b$10$hash')).toBe(false);
      expect(text.includes('password')).toBe(false);
    });
  });
});

describe('Project entity', () => {
  const row = { id: 3, name: 'Launch', description: 'Q4 launch', owner_id: 7 };

  describe('constructor', () => {
    it('stores every field', () => {
      const project = new Project({
        id: 3,
        name: 'Launch',
        description: 'Q4 launch',
        ownerId: 7,
      });

      expect(project.id).toBe(3);
      expect(project.name).toBe('Launch');
      expect(project.description).toBe('Q4 launch');
      expect(project.ownerId).toBe(7);
    });
  });

  describe('fromEntity', () => {
    it('maps owner_id to ownerId', () => {
      const project = Project.fromEntity(row);

      expect(project).toBeInstanceOf(Project);
      expect(project.id).toBe(3);
      expect(project.name).toBe('Launch');
      expect(project.description).toBe('Q4 launch');
      expect(project.ownerId).toBe(7);
    });
  });

  describe('toEntity', () => {
    it('returns the database shape without the id', () => {
      expect(Project.fromEntity(row).toEntity()).toStrictEqual({
        name: 'Launch',
        description: 'Q4 launch',
        owner_id: 7,
      });
    });
  });

  describe('toPublic', () => {
    it('returns id, name, description and ownerId', () => {
      expect(Project.fromEntity(row).toPublic()).toStrictEqual({
        id: 3,
        name: 'Launch',
        description: 'Q4 launch',
        ownerId: 7,
      });
    });

    it('keeps an empty description as an empty string', () => {
      const project = Project.fromEntity({ ...row, description: '' });

      expect(project.toPublic().description).toBe('');
      expect(project.toEntity().description).toBe('');
    });
  });
});

describe('ProjectMember entity', () => {
  const row = { project_id: 3, user_id: 7, role: 'member' };
  const joinedUser = { id: 7, name: 'Anna', email: 'anna@example.com' };

  describe('constructor', () => {
    it('stores every field', () => {
      const member = new ProjectMember({
        projectId: 3,
        userId: 7,
        role: 'owner',
        user: joinedUser,
      });

      expect(member.projectId).toBe(3);
      expect(member.userId).toBe(7);
      expect(member.role).toBe('owner');
      expect(member.user).toBe(joinedUser);
    });

    it('defaults user to null when it is not passed', () => {
      const member = new ProjectMember({ projectId: 3, userId: 7, role: 'member' });

      expect(member.user).toBe(null);
    });
  });

  describe('fromEntity', () => {
    it('maps snake_case columns and sets user to null without a join', () => {
      const member = ProjectMember.fromEntity(row);

      expect(member).toBeInstanceOf(ProjectMember);
      expect(member.projectId).toBe(3);
      expect(member.userId).toBe(7);
      expect(member.role).toBe('member');
      expect(member.user).toBe(null);
    });

    it('keeps the joined user', () => {
      const member = ProjectMember.fromEntity({ ...row, user: joinedUser });

      expect(member.user).toBe(joinedUser);
    });

    it('turns an explicit null user into null', () => {
      expect(ProjectMember.fromEntity({ ...row, user: null }).user).toBe(null);
    });
  });

  describe('toEntity', () => {
    it('returns the database shape', () => {
      expect(ProjectMember.fromEntity(row).toEntity()).toStrictEqual({
        project_id: 3,
        user_id: 7,
        role: 'member',
      });
    });

    it('does not include the joined user', () => {
      const member = ProjectMember.fromEntity({ ...row, user: joinedUser });

      expect(member.toEntity()).toStrictEqual({
        project_id: 3,
        user_id: 7,
        role: 'member',
      });
    });
  });

  describe('toPublic', () => {
    it('returns the user id with name, email and the membership role', () => {
      const member = ProjectMember.fromEntity({
        ...row,
        role: 'owner',
        user: joinedUser,
      });

      expect(member.toPublic()).toStrictEqual({
        id: 7,
        name: 'Anna',
        email: 'anna@example.com',
        role: 'owner',
      });
    });

    it('uses null for name and email when the user is not joined', () => {
      expect(ProjectMember.fromEntity(row).toPublic()).toStrictEqual({
        id: 7,
        name: null,
        email: null,
        role: 'member',
      });
    });

    it('uses null for a field missing from the joined user', () => {
      const member = ProjectMember.fromEntity({ ...row, user: { name: 'Anna' } });

      expect(member.toPublic()).toStrictEqual({
        id: 7,
        name: 'Anna',
        email: null,
        role: 'member',
      });
    });

    it('keeps an empty string instead of replacing it with null', () => {
      const member = ProjectMember.fromEntity({ ...row, user: { name: '', email: '' } });

      expect(member.toPublic().name).toBe('');
      expect(member.toPublic().email).toBe('');
    });

    it('takes the id from userId and ignores the id of the joined user', () => {
      const member = ProjectMember.fromEntity({
        ...row,
        user: { ...joinedUser, id: 999 },
      });

      expect(member.toPublic().id).toBe(7);
    });
  });
});

describe('Task entity', () => {
  const createdAt = new Date('2026-01-02T03:04:05.678Z');
  const updatedAt = new Date('2026-02-03T04:05:06.789Z');

  const row = {
    id: 11,
    project_id: 3,
    title: 'Write docs',
    description: 'Details',
    assignee_id: 7,
    priority: 'high',
    status: 'review',
    created_at: createdAt,
    updated_at: updatedAt,
  };

  const fields = {
    id: 11,
    projectId: 3,
    title: 'Write docs',
    description: 'Details',
    assigneeId: 7,
    priority: 'high',
    status: 'review',
    createdAt,
    updatedAt,
  };

  describe('constructor', () => {
    it('stores every field', () => {
      const task = new Task(fields);

      expect(task.id).toBe(11);
      expect(task.projectId).toBe(3);
      expect(task.title).toBe('Write docs');
      expect(task.description).toBe('Details');
      expect(task.assigneeId).toBe(7);
      expect(task.priority).toBe('high');
      expect(task.status).toBe('review');
      expect(task.createdAt).toBe(createdAt);
      expect(task.updatedAt).toBe(updatedAt);
    });
  });

  describe('fromEntity', () => {
    it('maps snake_case columns to camelCase fields', () => {
      expect(Task.fromEntity(row)).toStrictEqual(fields);
    });

    it('returns a plain object, not a Task instance', () => {
      // Фіксуємо поточну поведінку: fromEntity не створює екземпляр Task,
      // тож метод toPublic у результаті недоступний.
      const result = Task.fromEntity(row);

      expect(result instanceof Task).toBe(false);
      expect(result.toPublic).toBe(undefined);
    });

    it('keeps an unassigned task with assigneeId null', () => {
      expect(Task.fromEntity({ ...row, assignee_id: null }).assigneeId).toBe(null);
    });
  });

  describe('toEntity', () => {
    it('returns only the writable columns', () => {
      expect(new Task(fields).toEntity()).toStrictEqual({
        project_id: 3,
        title: 'Write docs',
        description: 'Details',
        assignee_id: 7,
        priority: 'high',
      });
    });

    it('leaves out id, status and timestamps so that the database sets them', () => {
      const entity = new Task(fields).toEntity();

      expect('id' in entity).toBe(false);
      expect('status' in entity).toBe(false);
      expect('created_at' in entity).toBe(false);
      expect('updated_at' in entity).toBe(false);
    });
  });

  describe('toPublic', () => {
    it('returns camelCase fields with timestamps as ISO strings', () => {
      expect(new Task(fields).toPublic()).toStrictEqual({
        id: 11,
        projectId: 3,
        title: 'Write docs',
        description: 'Details',
        assigneeId: 7,
        priority: 'high',
        status: 'review',
        createdAt: '2026-01-02T03:04:05.678Z',
        updatedAt: '2026-02-03T04:05:06.789Z',
      });
    });

    it('does not mix up createdAt and updatedAt', () => {
      const result = new Task(fields).toPublic();

      expect(result.createdAt).toBe(createdAt.toISOString());
      expect(result.updatedAt).toBe(updatedAt.toISOString());
      expect(result.createdAt === result.updatedAt).toBe(false);
    });

    it('keeps assigneeId null for an unassigned task', () => {
      const result = new Task({ ...fields, assigneeId: null }).toPublic();

      expect(result.assigneeId).toBe(null);
    });
  });
});
