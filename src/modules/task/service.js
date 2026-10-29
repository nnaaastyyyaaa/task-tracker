import { AppError } from '../../utils/errorHandler.js';
import { badRequest, checkBody, checkId, str } from '../../utils/validation.js';
import { Task } from './entity.js';

const projectNotFound = () => new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
const taskNotFound = () => new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
const forbidden = (message = 'Access denied') => new AppError(403, 'FORBIDDEN', message);
const notMember = () =>
  new AppError(422, 'ASSIGNEE_NOT_MEMBER', 'Assignee is not a member of the project');

export const STATUSES = ['todo', 'in_progress', 'review', 'done'];
export const PRIORITIES = ['low', 'medium', 'high'];

export class TaskService {
  constructor({ taskRepository, projectService, projectMemberService, userService }) {
    this.taskRepository = taskRepository;
    this.projectService = projectService;
    this.projectMemberService = projectMemberService;
    this.userService = userService;
  }

  async #projectRole(projectId, user) {
    const { exists, role } = await this.projectService.getAccess(projectId, user.id);
    if (!exists) throw projectNotFound();
    return role;
  }

  async #taskWithRole(taskId, user) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw taskNotFound();
    const { role } = await this.projectService.getAccess(task.projectId, user.id);
    if (!role) throw forbidden();
    return { task, role };
  }

  async #ownerTask(taskId, user) {
    const { task, role } = await this.#taskWithRole(taskId, user);
    if (role !== 'owner') throw forbidden('Only the project owner can do this');
    return task;
  }

  async #present(tasks) {
    const ids = [...new Set(tasks.map((t) => t.assigneeId))];
    const users = await this.userService.findByIds(ids);
    const names = new Map(users.map((u) => [u.id, u.name]));
    return tasks.map((t) => ({
      ...t,
      assigneeName: names.get(t.assigneeId) ?? null,
    }));
  }

  async #presentOne(task) {
    return (await this.#present([task]))[0];
  }

  async create(currentUser, projectId, body) {
    const role = await this.#projectRole(projectId, currentUser);
    if (role !== 'owner') throw forbidden('Only the project owner can create tasks');

    checkBody(body, ['title', 'description', 'assigneeId', 'priority']);
    const title = str(body.title, 'title', { min: 2, max: 200 });
    const description =
      body.description === undefined
        ? ''
        : str(body.description, 'description', { max: 5000 });
    const taskPriority = body.priority === undefined ? 'medium' : body.priority;

    if (!PRIORITIES.includes(taskPriority)) {
      throw badRequest('priority: LOW, MEDIUM or HIGH');
    }

    const assigneeId = checkId(body.assigneeId, 'assigneeId');
    if (!(await this.projectMemberService.isMember(projectId, assigneeId)))
      throw notMember();

    const task = new Task({
      projectId,
      assigneeId: body.assigneeId,
      title: title.trim(),
      description: description,
      priority: taskPriority,
    }).toEntity();

    const createdTask = await this.taskRepository.create(task);
    return this.#presentOne(createdTask);
  }

  async update(user, taskId, body) {
    const task = await this.#ownerTask(taskId, user);

    checkBody(body, ['title', 'description', 'priority']);
    const fields = {};
    if (body.title !== undefined)
      fields.title = str(body.title, 'title', { min: 2, max: 200 });
    if (body.description !== undefined) {
      fields.description = str(body.description, 'description', { max: 5000 });
    }
    if (body.priority !== undefined) {
      if (!PRIORITIES.includes(body.priority))
        throw badRequest('priority: LOW, MEDIUM or HIGH');
      fields.priority = body.priority;
    }
    if (Object.keys(fields).length === 0)
      throw badRequest('At least one field is required');

    const updated = await this.taskRepository.update(task.id, fields);
    return this.#presentOne(updated);
  }

  async listByProject(user, projectId, assignee) {
    const role = await this.#projectRole(projectId, user);
    if (!role) throw forbidden();

    let assigneeId;
    if (assignee !== undefined && assignee !== 'me') {
      throw badRequest('assignee must be "me"');
    }
    if (assignee === 'me') assigneeId = user.id;
    const tasks = await this.taskRepository.findByProject(projectId, assigneeId);
    return this.#present(tasks);
  }

  async getById(user, taskId) {
    const { task } = await this.#taskWithRole(taskId, user);
    return this.#presentOne(task);
  }

  async changeStatus(user, taskId, body) {
    const { task, role } = await this.#taskWithRole(taskId, user);
    if (role !== 'owner' && task.assigneeId !== user.id) throw forbidden();

    checkBody(body, ['status']);
    if (!STATUSES.includes(body.status)) {
      throw badRequest('Invalid task status');
    }

    if (body.status === task.status) return this.#presentOne(task);
    if (
      !(Math.abs(STATUSES.indexOf(task.status) - STATUSES.indexOf(body.status)) === 1)
    ) {
      throw new AppError(
        422,
        'INVALID_STATUS_TRANSITION',
        'Only adjacent columns are allowed',
      );
    }

    const updated = await this.taskRepository.updateStatus(
      task.id,
      task.status,
      body.status,
    );
    if (!updated)
      throw new AppError(
        409,
        'CONCURRENT_UPDATE',
        'Task status was changed concurrently',
      );
    return this.#presentOne(updated);
  }

  async changeAssignee(user, taskId, body) {
    const task = await this.#ownerTask(taskId, user);

    checkBody(body, ['assigneeId']);
    const assigneeId = checkId(body.assigneeId, 'assigneeId');
    if (!(await this.projectMemberService.isMember(task.projectId, assigneeId)))
      throw notMember();

    const updated = await this.taskRepository.update(task.id, {
      assignee_id: assigneeId,
    });
    return this.#presentOne(updated);
  }

  async remove(user, taskId) {
    await this.#ownerTask(taskId, user);
    await this.taskRepository.delete(taskId);
  }
}
