import { AppError } from '../../utils/errorHandler.js';
import { Task } from './entity.js';

const projectNotFound = () => new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');
const taskNotFound = () => new AppError(404, 'TASK_NOT_FOUND', 'Task not found');
const forbidden = (message = 'Access denied') => new AppError(403, 'FORBIDDEN', message);
const badRequest = (message) => new AppError(400, 'VALIDATION_ERROR', message);
export const STATUSES = ['todo', 'in_progress', 'review', 'done'];
export const PRIORITIES = ['low', 'medium', 'high'];

export class TaskService {
  constructor(taskRepository, projectService, projectMemberService) {
    this.taskRepository = taskRepository;
    this.projectService = projectService;
    this.projectMemberService = projectMemberService;
  }

  async create({
    currentUser,
    projectId,
    title,
    description,
    assigneeId,
    priority = 'medium',
  }) {
    if (currentUser.role !== 'team_lead') {
      throw forbidden('Only a team lead can create task in project');
    }
    const { exists, role } = await this.projectService.getAccess(
      projectId,
      currentUser.id,
    );
    if (!exists) throw projectNotFound();
    if (role !== 'owner') throw forbidden('Only the project owner can create tasks');

    if (
      !title ||
      title.trim() === '' ||
      !description ||
      description.trim() === '' ||
      !assigneeId
    ) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter all required fields');
    }

    const taskPriority = priority?.trim() !== '' ? priority : 'medium';

    if (!PRIORITIES.includes(taskPriority)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Enter another priority');
    }

    if (!(await this.projectMemberService.isMember(projectId, assigneeId)))
      throw new AppError(
        422,
        'ASSIGNEE_NOT_MEMBER',
        'Assignee is not a member of the project',
      );
    const now = new Date();
    const task = new Task({
      projectId,
      title,
      description,
      assigneeId,
      priority,
      status: 'todo',
      createdAt: now,
      updatedAt: now,
    }).toEntity();

    const createdTask = await this.taskRepository.create(task);
    return createdTask;
  }

  async update({ user, taskId, title, description, priority }) {
    if (user.role !== 'team_lead') {
      throw forbidden('Only a team lead can update task in project');
    }
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

    const { role } = await this.projectService.getAccess(task.projectId, user.id);
    if (!role) throw forbidden();

    const fields = {};
    if (title !== undefined) fields.title = title.trim();
    if (description !== undefined) fields.description = description.trim();

    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) throw badRequest('Enter another priority');
      fields.priority = priority;
    }
    if (Object.keys(fields).length === 0)
      throw badRequest('At least one field is required');

    const updated = await this.taskRepository.update(task.id, fields);
    if (!updated) throw taskNotFound();
    return updated;
  }

  async listByProject(user, projectId, assignee) {
    const { exists, role } = await this.projectService.getAccess(projectId, user.id);
    if (!exists) throw projectNotFound();
    if (!role) throw forbidden();
    let assigneeId;
    if (assignee !== undefined) {
      assigneeId = Number(assignee);
      if (assigneeId !== user.id && user.role !== 'team_lead') {
        throw forbidden('You can only filter by your own tasks');
      }
    }
    const tasks = await this.taskRepository.findByProject(projectId, assigneeId);
    return tasks;
  }

  async getById(user, taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

    const { role } = await this.projectService.getAccess(task.projectId, user.id);
    if (!role) throw forbidden();
    return task;
  }

  async changeStatus(user, taskId, status) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new AppError(404, 'TASK_NOT_FOUND', 'Task not found');

    const { role } = await this.projectService.getAccess(task.projectId, user.id);
    if (!role) throw forbidden();

    if (task.assigneeId !== user.id) throw forbidden();

    if (!STATUSES.includes(status.trim()))
      throw badRequest('Enter another value for status');

    if (status === task.status) return task;
    if (!(Math.abs(STATUSES.indexOf(task.status) - STATUSES.indexOf(status)) === 1)) {
      throw new AppError(
        422,
        'INVALID_STATUS_TRANSITION',
        'Only adjacent columns are allowed',
      );
    }

    const updated = await this.taskRepository.updateStatus(task.id, task.status, status);
    if (!updated)
      throw new AppError(
        409,
        'CONCURRENT_UPDATE',
        'Task status was changed concurrently',
      );
    return updated;
  }

  async changeAssignee(user, taskId, assigneeId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw taskNotFound();
    const { role } = await this.projectService.getAccess(task.projectId, user.id);
    if (!role) throw forbidden();
    if (role !== 'owner') throw forbidden();

    if (!(await this.projectMemberService.isMember(task.projectId, assigneeId)))
      throw new AppError(
        422,
        'ASSIGNEE_NOT_MEMBER',
        'Assignee is not a member of the project',
      );

    const updated = await this.taskRepository.update(task.id, {
      assignee_id: assigneeId,
    });
    if (!updated) throw taskNotFound();
    return updated;
  }

  async remove(user, taskId) {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw taskNotFound();
    const { role } = await this.projectService.getAccess(task.projectId, user.id);
    if (!role) throw forbidden();
    if (role !== 'owner') throw forbidden();
    await this.taskRepository.delete(task.id);
  }
}
