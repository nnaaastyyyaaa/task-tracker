import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskService } from '../../src/modules/task/service.js';

describe('TaskService', () => {
  let taskRepository;
  let projectService;
  let projectMemberService;
  let userService;
  let service;

  const owner = { id: 1, name: 'Owner', role: 'team_lead' };
  const assignee = { id: 2, name: 'Bob', role: 'team_member' };
  const otherMember = { id: 4, name: 'Carol', role: 'team_member' };
  const outsider = { id: 3, name: 'Dave', role: 'team_member' };

  const createdAt = new Date('2026-10-01T10:00:00.000Z');
  const updatedAt = new Date('2026-10-02T11:30:00.000Z');

  const makeTask = (overrides = {}) => ({
    id: 5,
    projectId: 10,
    title: 'Write tests',
    description: '',
    assigneeId: 2,
    priority: 'medium',
    status: 'todo',
    createdAt,
    updatedAt,
    ...overrides,
  });

  const asRole = (role) =>
    projectService.getAccess.mockResolvedValue({ exists: true, role });

  const projectMissing = () =>
    projectService.getAccess.mockResolvedValue({ exists: false, role: null });

  beforeEach(() => {
    taskRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByProject: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    };

    projectService = { getAccess: vi.fn() };
    projectMemberService = { isMember: vi.fn() };
    userService = { findByIds: vi.fn().mockResolvedValue([{ id: 2, name: 'Bob' }]) };

    service = new TaskService({
      taskRepository,
      projectService,
      projectMemberService,
      userService,
    });
  });

  describe('create', () => {
    const body = {
      title: 'Write tests',
      description: 'Cover everything',
      assigneeId: 2,
      priority: 'high',
    };

    beforeEach(() => {
      asRole('owner');
      projectMemberService.isMember.mockResolvedValue(true);
      taskRepository.create.mockImplementation(async (entity) =>
        makeTask({
          projectId: entity.project_id,
          title: entity.title,
          description: entity.description,
          assigneeId: entity.assignee_id,
          priority: entity.priority,
        }),
      );
    });

    it('lets the project owner create a task and returns it with the assignee name', async () => {
      const result = await service.create(owner, 10, body);

      expect(projectService.getAccess).toHaveBeenCalledWith(10, 1);
      expect(projectMemberService.isMember).toHaveBeenCalledWith(10, 2);
      expect(taskRepository.create).toHaveBeenCalledWith({
        project_id: 10,
        title: 'Write tests',
        description: 'Cover everything',
        assignee_id: 2,
        priority: 'high',
      });
      expect(userService.findByIds).toHaveBeenCalledWith([2]);
      expect(result).toMatchObject({
        projectId: 10,
        title: 'Write tests',
        assigneeId: 2,
        assigneeName: 'Bob',
      });
    });

    it('trims title and description', async () => {
      await service.create(owner, 10, {
        title: '  Write tests  ',
        description: '  Cover everything  ',
        assigneeId: 2,
      });

      expect(taskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Write tests',
          description: 'Cover everything',
        }),
      );
    });

    it('applies defaults: priority "medium" and empty description', async () => {
      await service.create(owner, 10, { title: 'Write tests', assigneeId: 2 });

      expect(taskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'medium', description: '' }),
      );
    });

    it.each(['low', 'medium', 'high'])('accepts priority "%s"', async (priority) => {
      await service.create(owner, 10, { title: 'Write tests', assigneeId: 2, priority });

      expect(taskRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ priority }),
      );
    });

    it.each([
      ['title of exactly 2 characters', { title: 'ab' }],
      ['title of exactly 200 characters', { title: 'a'.repeat(200) }],
      ['description of exactly 5000 characters', { description: 'a'.repeat(5000) }],
    ])('accepts boundary value: %s', async (_case, overrides) => {
      await expect(
        service.create(owner, 10, { title: 'Write tests', assigneeId: 2, ...overrides }),
      ).resolves.toBeDefined();
    });

    it('returns 404 for a non-existent project, even with an invalid body', async () => {
      projectMissing();

      await expect(service.create(owner, 999, { extra: true })).rejects.toMatchObject({
        status: 404,
        code: 'PROJECT_NOT_FOUND',
      });

      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it.each([
      ['a regular project member', 'member'],
      ['a user outside the project', null],
    ])('forbids %s from creating tasks (403)', async (_case, role) => {
      asRole(role);

      await expect(service.create(assignee, 10, body)).rejects.toMatchObject({
        status: 403,
      });

      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid body from a non-owner with 403, not 400', async () => {
      asRole('member');

      await expect(service.create(assignee, 10, { extra: true })).rejects.toMatchObject({
        status: 403,
      });
    });

    it.each([
      ['title shorter than 2 characters', { title: 'a' }],
      ['title longer than 200 characters', { title: 'a'.repeat(201) }],
      ['title is only whitespace', { title: '   ' }],
      ['title is missing', { title: undefined }],
      ['title is not a string', { title: 42 }],
      ['description longer than 5000 characters', { description: 'a'.repeat(5001) }],
      ['description is not a string', { description: 123 }],
      ['unknown priority', { priority: 'urgent' }],
      ['priority in upper case', { priority: 'HIGH' }],
      ['priority is not a string', { priority: 1 }],
      ['assigneeId is missing', { assigneeId: undefined }],
      ['assigneeId is null', { assigneeId: null }],
      ['assigneeId is not a number', { assigneeId: 'abc' }],
      ['assigneeId is not an integer', { assigneeId: 1.5 }],
      ['unknown field in body', { extra: true }],
    ])('rejects request with 400: %s', async (_case, overrides) => {
      const invalid = { title: 'Write tests', assigneeId: 2, ...overrides };

      await expect(service.create(owner, 10, invalid)).rejects.toMatchObject({
        status: 400,
      });

      expect(projectMemberService.isMember).not.toHaveBeenCalled();
      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an assignee who is not a project member with 422', async () => {
      projectMemberService.isMember.mockResolvedValue(false);

      await expect(service.create(owner, 10, body)).rejects.toMatchObject({
        status: 422,
        code: 'ASSIGNEE_NOT_MEMBER',
      });

      expect(taskRepository.create).not.toHaveBeenCalled();
    });

    it('returns assigneeName null when the assignee cannot be resolved', async () => {
      userService.findByIds.mockResolvedValue([]);

      const result = await service.create(owner, 10, body);

      expect(result.assigneeName).toBeNull();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      taskRepository.findById.mockResolvedValue(makeTask());
      asRole('owner');
      taskRepository.update.mockImplementation(async (id, fields) =>
        makeTask({ id, ...fields }),
      );
    });

    it('lets the owner update title, description and priority', async () => {
      const result = await service.update(owner, 5, {
        title: '  New title  ',
        description: 'New description',
        priority: 'high',
      });

      expect(taskRepository.update).toHaveBeenCalledWith(5, {
        title: 'New title',
        description: 'New description',
        priority: 'high',
      });
      expect(result).toMatchObject({
        title: 'New title',
        description: 'New description',
        priority: 'high',
        assigneeName: 'Bob',
      });
    });

    it.each([
      ['title only', { title: 'New title' }, { title: 'New title' }],
      [
        'description only',
        { description: 'New description' },
        { description: 'New description' },
      ],
      ['priority only', { priority: 'low' }, { priority: 'low' }],
    ])('updates only the provided field: %s', async (_case, body, expectedFields) => {
      await service.update(owner, 5, body);

      expect(taskRepository.update).toHaveBeenCalledWith(5, expectedFields);
    });

    it('returns 404 for a non-existent task', async () => {
      taskRepository.findById.mockResolvedValue(null);

      await expect(
        service.update(owner, 999, { title: 'New title' }),
      ).rejects.toMatchObject({
        status: 404,
        code: 'TASK_NOT_FOUND',
      });

      expect(projectService.getAccess).not.toHaveBeenCalled();
    });

    it.each([
      ['a user outside the project', null],
      ['a regular project member', 'member'],
    ])('forbids %s from editing the task (403)', async (_case, role) => {
      asRole(role);

      await expect(
        service.update(assignee, 5, { title: 'New title' }),
      ).rejects.toMatchObject({
        status: 403,
      });

      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('rejects an invalid body from a non-owner with 403, not 400', async () => {
      asRole('member');

      await expect(service.update(assignee, 5, {})).rejects.toMatchObject({
        status: 403,
      });
    });

    it.each([
      ['empty body', {}],
      ['title too short', { title: 'a' }],
      ['title too long', { title: 'a'.repeat(201) }],
      ['description too long', { description: 'a'.repeat(5001) }],
      ['unknown priority', { priority: 'urgent' }],
      ['unknown field', { status: 'done' }],
    ])('rejects request with 400: %s', async (_case, body) => {
      await expect(service.update(owner, 5, body)).rejects.toMatchObject({ status: 400 });

      expect(taskRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('listByProject', () => {
    const tasks = [
      makeTask({ id: 5, assigneeId: 2 }),
      makeTask({ id: 6, assigneeId: 4 }),
    ];

    beforeEach(() => {
      asRole('owner');
      taskRepository.findByProject.mockResolvedValue(tasks);
      userService.findByIds.mockResolvedValue([
        { id: 2, name: 'Bob' },
        { id: 4, name: 'Carol' },
      ]);
    });

    it('returns all tasks of the project when no filter is given', async () => {
      const result = await service.listByProject(owner, 10);

      expect(taskRepository.findByProject).toHaveBeenCalledWith(10, undefined);
      expect(result.map((t) => [t.id, t.assigneeName])).toEqual([
        [5, 'Bob'],
        [6, 'Carol'],
      ]);
    });

    it('requests every assignee only once when resolving names', async () => {
      taskRepository.findByProject.mockResolvedValue([
        makeTask({ id: 5, assigneeId: 2 }),
        makeTask({ id: 6, assigneeId: 2 }),
      ]);

      await service.listByProject(owner, 10);

      expect(userService.findByIds).toHaveBeenCalledWith([2]);
    });

    it('returns only the tasks of the current user for assignee=me', async () => {
      asRole('member');

      await service.listByProject(assignee, 10, 'me');

      expect(taskRepository.findByProject).toHaveBeenCalledWith(10, 2);
    });

    it('lets a regular project member see the board', async () => {
      asRole('member');

      await expect(service.listByProject(assignee, 10)).resolves.toHaveLength(2);
    });

    it('returns an empty list for a project without tasks', async () => {
      taskRepository.findByProject.mockResolvedValue([]);
      userService.findByIds.mockResolvedValue([]);

      await expect(service.listByProject(owner, 10)).resolves.toEqual([]);
    });

    it('returns 404 for a non-existent project', async () => {
      projectMissing();

      await expect(service.listByProject(owner, 999)).rejects.toMatchObject({
        status: 404,
      });

      expect(taskRepository.findByProject).not.toHaveBeenCalled();
    });

    it('returns 403 for a user outside the project', async () => {
      asRole(null);

      await expect(service.listByProject(outsider, 10)).rejects.toMatchObject({
        status: 403,
      });

      expect(taskRepository.findByProject).not.toHaveBeenCalled();
    });

    it('checks access before validating the filter (403 before 400)', async () => {
      asRole(null);

      await expect(service.listByProject(outsider, 10, 'all')).rejects.toMatchObject({
        status: 403,
      });
    });

    it.each(['all', '', 'ME', '2', 'someone'])(
      'rejects assignee filter "%s" with 400',
      async (assigneeFilter) => {
        await expect(
          service.listByProject(owner, 10, assigneeFilter),
        ).rejects.toMatchObject({
          status: 400,
        });

        expect(taskRepository.findByProject).not.toHaveBeenCalled();
      },
    );
  });

  describe('getById', () => {
    it('returns the task with the assignee name for a project member', async () => {
      taskRepository.findById.mockResolvedValue(makeTask());
      asRole('member');

      const result = await service.getById(assignee, 5);

      expect(projectService.getAccess).toHaveBeenCalledWith(10, 2);
      expect(result).toMatchObject({ id: 5, assigneeName: 'Bob' });
    });

    it('returns 404 for a non-existent task', async () => {
      taskRepository.findById.mockResolvedValue(null);

      await expect(service.getById(owner, 999)).rejects.toMatchObject({
        status: 404,
        code: 'TASK_NOT_FOUND',
      });
    });

    it('returns 403 for a user outside the project', async () => {
      taskRepository.findById.mockResolvedValue(makeTask());
      asRole(null);

      await expect(service.getById(outsider, 5)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('changeStatus', () => {
    beforeEach(() => {
      taskRepository.findById.mockResolvedValue(makeTask({ status: 'todo' }));
      asRole('owner');
      taskRepository.updateStatus.mockImplementation(async (id, _from, to) =>
        makeTask({ id, status: to }),
      );
    });

    it('lets the owner change the status', async () => {
      const result = await service.changeStatus(owner, 5, { status: 'in_progress' });

      expect(taskRepository.updateStatus).toHaveBeenCalledWith(5, 'todo', 'in_progress');
      expect(result).toMatchObject({ status: 'in_progress', assigneeName: 'Bob' });
    });

    it('lets the task assignee change the status', async () => {
      asRole('member');

      const result = await service.changeStatus(assignee, 5, { status: 'in_progress' });

      expect(result.status).toBe('in_progress');
    });

    it('forbids another project member from changing the status (403)', async () => {
      asRole('member');

      await expect(
        service.changeStatus(otherMember, 5, { status: 'in_progress' }),
      ).rejects.toMatchObject({ status: 403 });

      expect(taskRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('forbids a user outside the project from changing the status (403)', async () => {
      asRole(null);

      await expect(
        service.changeStatus(outsider, 5, { status: 'in_progress' }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('returns 404 for a non-existent task', async () => {
      taskRepository.findById.mockResolvedValue(null);

      await expect(
        service.changeStatus(owner, 999, { status: 'in_progress' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('checks permissions before validating the body (403 before 400)', async () => {
      asRole('member');

      await expect(
        service.changeStatus(otherMember, 5, { status: 'bogus' }),
      ).rejects.toMatchObject({
        status: 403,
      });
    });

    it.each([
      ['unknown status', { status: 'blocked' }],
      ['status in upper case', { status: 'TODO' }],
      ['missing status', {}],
      ['status is not a string', { status: 1 }],
      ['unknown field', { status: 'in_progress', extra: true }],
    ])('rejects request with 400: %s', async (_case, body) => {
      await expect(service.changeStatus(owner, 5, body)).rejects.toMatchObject({
        status: 400,
      });

      expect(taskRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('returns 409 when the status was changed concurrently', async () => {
      taskRepository.updateStatus.mockResolvedValue(null);

      await expect(
        service.changeStatus(owner, 5, { status: 'in_progress' }),
      ).rejects.toMatchObject({ status: 409, code: 'CONCURRENT_UPDATE' });
    });

    describe('status transitions (all 16 pairs)', () => {
      const allowed = {
        todo: ['in_progress'],
        in_progress: ['todo', 'review'],
        review: ['in_progress', 'done'],
        done: ['review'],
      };
      const statuses = ['todo', 'in_progress', 'review', 'done'];

      const pairs = statuses.flatMap((from) =>
        statuses.map((to) => {
          if (from === to) return [from, to, 'same'];
          return [from, to, allowed[from].includes(to) ? 'adjacent' : 'jump'];
        }),
      );

      it.each(pairs)('%s -> %s (%s)', async (from, to, kind) => {
        taskRepository.findById.mockResolvedValue(makeTask({ status: from }));

        if (kind === 'same') {
          const result = await service.changeStatus(owner, 5, { status: to });

          expect(result.status).toBe(from);
          expect(taskRepository.updateStatus).not.toHaveBeenCalled();
        } else if (kind === 'adjacent') {
          const result = await service.changeStatus(owner, 5, { status: to });

          expect(taskRepository.updateStatus).toHaveBeenCalledWith(5, from, to);
          expect(result.status).toBe(to);
        } else {
          await expect(
            service.changeStatus(owner, 5, { status: to }),
          ).rejects.toMatchObject({
            status: 422,
            code: 'INVALID_STATUS_TRANSITION',
          });

          expect(taskRepository.updateStatus).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('changeAssignee', () => {
    beforeEach(() => {
      taskRepository.findById.mockResolvedValue(makeTask({ assigneeId: 2 }));
      asRole('owner');
      projectMemberService.isMember.mockResolvedValue(true);
      taskRepository.update.mockImplementation(async (id, fields) =>
        makeTask({ id, assigneeId: fields.assignee_id }),
      );
      userService.findByIds.mockResolvedValue([{ id: 4, name: 'Carol' }]);
    });

    it('lets the owner assign another project member', async () => {
      const result = await service.changeAssignee(owner, 5, { assigneeId: 4 });

      expect(projectMemberService.isMember).toHaveBeenCalledWith(10, 4);
      expect(taskRepository.update).toHaveBeenCalledWith(5, { assignee_id: 4 });
      expect(result).toMatchObject({ assigneeId: 4, assigneeName: 'Carol' });
    });

    it('rejects an assignee who is not a project member with 422', async () => {
      projectMemberService.isMember.mockResolvedValue(false);

      await expect(
        service.changeAssignee(owner, 5, { assigneeId: 99 }),
      ).rejects.toMatchObject({
        status: 422,
        code: 'ASSIGNEE_NOT_MEMBER',
      });

      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('returns 404 for a non-existent task', async () => {
      taskRepository.findById.mockResolvedValue(null);

      await expect(
        service.changeAssignee(owner, 999, { assigneeId: 4 }),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it.each([
      ['the current assignee', 'member'],
      ['a user outside the project', null],
    ])('forbids %s from changing the assignee (403)', async (_case, role) => {
      asRole(role);

      await expect(
        service.changeAssignee(assignee, 5, { assigneeId: 4 }),
      ).rejects.toMatchObject({
        status: 403,
      });

      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('checks permissions before validating the body (403 before 400)', async () => {
      asRole('member');

      await expect(service.changeAssignee(assignee, 5, {})).rejects.toMatchObject({
        status: 403,
      });
    });

    it.each([
      ['assigneeId is missing', {}],
      ['assigneeId is null', { assigneeId: null }],
      ['assigneeId is not a number', { assigneeId: 'abc' }],
      ['assigneeId is not an integer', { assigneeId: 1.5 }],
      ['unknown field', { assigneeId: 4, extra: true }],
    ])('rejects request with 400: %s', async (_case, body) => {
      await expect(service.changeAssignee(owner, 5, body)).rejects.toMatchObject({
        status: 400,
      });

      expect(projectMemberService.isMember).not.toHaveBeenCalled();
      expect(taskRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      taskRepository.findById.mockResolvedValue(makeTask());
      asRole('owner');
    });

    it('lets the owner delete the task', async () => {
      await expect(service.remove(owner, 5)).resolves.toBeUndefined();

      expect(taskRepository.delete).toHaveBeenCalledWith(5);
    });

    it('returns 404 for a non-existent task', async () => {
      taskRepository.findById.mockResolvedValue(null);

      await expect(service.remove(owner, 999)).rejects.toMatchObject({ status: 404 });

      expect(taskRepository.delete).not.toHaveBeenCalled();
    });

    it.each([
      ['the assignee', 'member'],
      ['a user outside the project', null],
    ])('forbids %s from deleting the task (403)', async (_case, role) => {
      asRole(role);

      await expect(service.remove(assignee, 5)).rejects.toMatchObject({ status: 403 });

      expect(taskRepository.delete).not.toHaveBeenCalled();
    });
  });
});
