import { TaskRepository } from '../modules/task/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { database } from './db.js';
import { projectService } from './project.js';
import { TaskService } from '../modules/task/service.js';

const taskRepository = new TaskRepository(database);
const projectRepository = new ProjectRepository(database);

export const taskService = new TaskService(
  taskRepository,
  projectRepository,
  projectService,
);
