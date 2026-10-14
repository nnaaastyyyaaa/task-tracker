import { TaskRepository } from '../modules/task/repository.js';
import { ProjectRepository } from '../modules/project/repository.js';
import { projectService } from './project.js';
import { TaskService } from '../modules/task/service.js';
import { prisma } from '../db/prisma.js';

const taskRepository = new TaskRepository(prisma);
const projectRepository = new ProjectRepository(prisma);

export const taskService = new TaskService(
  taskRepository,
  projectRepository,
  projectService,
);
