import { UserRepository } from '../modules/user/repository.js';
import { SessionRepository } from '../modules/session/repository.js';
import { UserService } from '../modules/user/service.js';
import { createCheckUser } from '../utils/checkUser.js';
import { db } from '../store/memory.js';

const database = new db();
const userRepository = new UserRepository(database);
const sessionRepository = new SessionRepository(database);

export const userService = new UserService(userRepository, sessionRepository);
export const checkUser = createCheckUser(userService);
