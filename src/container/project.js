import { ProjectRepository } from '../modules/project/repository.js';
import { userService } from './user.js';
import { ProjectService } from '../modules/project/service.js';
import { prisma } from '../db/prisma.js';

const projectRepository = new ProjectRepository(prisma);

export const projectService = new ProjectService({ projectRepository, userService });
