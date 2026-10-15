export class AppError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

const TRANSIENT_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2034',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  '40001',
  '40P01',
  '57P01',
  '08006',
  '08001',
]);

export function isTransient(error) {
  const code = error?.code ?? error?.errorCode ?? error?.cause?.code;
  return TRANSIENT_CODES.has(code);
}

export function CustomHandler(fastify) {
  fastify.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  fastify.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply
        .headers(error.headers)
        .status(error.status)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (isTransient(error)) {
      request.log.error(error);
      return reply
        .header('Retry-After', '5')
        .code(503)
        .send({
          error: {
            code: 'STORAGE_UNAVAILABLE',
            message: 'Storage is temporarily unavailable',
          },
        });
    }
    if (error.validation || error.statusCode === 400) {
      return reply
        .code(400)
        .send({ error: { code: 'VALIDATION_ERROR', message: error.message } });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply
        .code(error.statusCode)
        .send({ error: { code: 'BAD_REQUEST', message: error.message } });
    }
    request.log.error(error);
    reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    });
  });
}
