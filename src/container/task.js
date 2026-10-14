import { TaskRepository } from '../modules/task/repository.js';
import { projectService } from './project.js';
import { projectMemberService } from './projectMember.js';
import { TaskService } from '../modules/task/service.js';
import { prisma } from '../db/prisma.js';

const taskRepository = new TaskRepository(prisma);

export const taskService = new TaskService(
  taskRepository,
  projectService,
  projectMemberService,
);
