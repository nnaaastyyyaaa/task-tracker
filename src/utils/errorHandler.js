export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function CustomHandler(fastify) {
  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.status)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (error.validation || (error.statusCode && error.statusCode < 500)) {
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: error.message } });
    }
    reply.status(error.statusCode || 500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Something went wrong',
      },
    });
  });
}
