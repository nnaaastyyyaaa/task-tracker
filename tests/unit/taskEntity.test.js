import { describe, expect, it } from 'vitest';
import { Task } from '../../src/modules/task/entity.js';

describe('Task entity', () => {
  const createdAt = new Date('2026-10-01T10:00:00.000Z');
  const updatedAt = new Date('2026-10-02T11:30:00.000Z');

  const fields = {
    id: 5,
    projectId: 10,
    title: 'Write tests',
    description: 'Cover the task module',
    assigneeId: 2,
    priority: 'high',
    status: 'in_progress',
    createdAt,
    updatedAt,
  };

  describe('constructor', () => {
    it('assigns all fields', () => {
      expect(new Task(fields)).toMatchObject(fields);
    });
  });

  describe('toPublic', () => {
    it('returns public data with dates serialized as ISO strings', () => {
      expect(new Task(fields).toPublic()).toEqual({
        id: 5,
        projectId: 10,
        title: 'Write tests',
        description: 'Cover the task module',
        assigneeId: 2,
        priority: 'high',
        status: 'in_progress',
        createdAt: '2026-10-01T10:00:00.000Z',
        updatedAt: '2026-10-02T11:30:00.000Z',
      });
    });
  });

  describe('toEntity', () => {
    it('returns only the writable database columns', () => {
      expect(new Task(fields).toEntity()).toEqual({
        project_id: 10,
        title: 'Write tests',
        description: 'Cover the task module',
        assignee_id: 2,
        priority: 'high',
      });
    });

    it('does not include id, status or timestamps', () => {
      const entity = new Task(fields).toEntity();

      expect(entity).not.toHaveProperty('id');
      expect(entity).not.toHaveProperty('status');
      expect(entity).not.toHaveProperty('created_at');
      expect(entity).not.toHaveProperty('updated_at');
    });
  });

  describe('fromEntity', () => {
    it('maps a database row to camelCase fields', () => {
      const row = {
        id: 5,
        project_id: 10,
        title: 'Write tests',
        description: 'Cover the task module',
        assignee_id: 2,
        priority: 'high',
        status: 'in_progress',
        created_at: createdAt,
        updated_at: updatedAt,
      };

      expect(Task.fromEntity(row)).toEqual(fields);
    });
  });
});
