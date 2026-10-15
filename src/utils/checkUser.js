import { AppError } from './errorHandler.js';

export function createCheckUser(userService) {
  return async function checkUser(request) {
    const sid = request.cookies.sid;
    const user = sid ? await userService.getBySession(sid) : null;
    if (!user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
    }
    request.user = user;
    request.sid = sid;
  };
}
