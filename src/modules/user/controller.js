import { SESSION_TTL } from './service.js';
export class UserController {
  constructor({ userService }) {
    this.userService = userService;
  }

  sendResponse = (reply, data, status = 200) => {
    reply.code(status).send({ data });
  };

  register = async (request, reply) => {
    console.log('controller');
    const created = this.userService.register(request.body);
    this.sendResponse(reply, created.id, 201);
  };

  login = async (request, reply) => {
    const { sid, user } = await this.userService.login(request.body);
    reply.setCookie('sid', sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL / 1000,
    });
    this.sendResponse(reply, user);
  };

  logout = async (request, reply) => {
    await this.userService.logout(request.sid);
    reply.clearCookie('sid', { path: '/' });
    this.sendResponse(reply, 'user logout', 204);
  };
}
