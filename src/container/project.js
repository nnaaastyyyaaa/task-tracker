import { ProjectRepository } from '../modules/project/repository.js';
import { userService } from './user.js';
import { ProjectService } from '../modules/project/service.js';
import { database } from './db.js';

const projectRepository = new ProjectRepository(database);

export const projectService = new ProjectService({ projectRepository, userService });
