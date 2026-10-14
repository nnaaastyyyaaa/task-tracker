import { UserRepository } from '../modules/user/repository.js';
import { SessionRepository } from '../modules/session/repository.js';
import { UserService } from '../modules/user/service.js';
import { createCheckUser } from '../utils/checkUser.js';
import { prisma } from '../db/prisma.js';

const userRepository = new UserRepository(prisma);
const sessionRepository = new SessionRepository(prisma);

export const userService = new UserService(userRepository, sessionRepository);
export const checkUser = createCheckUser(userService);
