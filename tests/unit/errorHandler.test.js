import { describe, it, expect, vi } from 'vitest';
import { AppError, isTransient, CustomHandler } from '../../src/utils/errorHandler.js';

describe('AppError', () => {
  it('return error with status, code and message', () => {
    const error = new AppError(400, 'VALIDATION_ERROR', 'Invalid input');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Invalid input');
    expect(error.headers).toEqual({});
  });

  it('saves HTTP-headers', () => {
    const headers = { 'Retry-After': '5' };
    const error = new AppError(503, 'STORAGE_UNAVAILABLE', 'Try again later', headers);

    expect(error.headers).toEqual(headers);
  });
});

describe('isTransient', () => {
  it.each([
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
  ])('return true for temporary code %s', (code) => {
    expect(isTransient({ code })).toBe(true);
  });

  it('check code in properties errorCode', () => {
    expect(isTransient({ errorCode: 'ECONNRESET' })).toBe(true);
  });

  it('check code in nested error cause', () => {
    expect(isTransient({ cause: { code: 'ETIMEDOUT' } })).toBe(true);
  });

  it('return false for unknown code', () => {
    expect(isTransient({ code: 'UNKNOWN_ERROR' })).toBe(false);
  });

  it('return false, if code is absent', () => {
    expect(isTransient({})).toBe(false);
  });

  it('return false, if error is null or undefined', () => {
    expect(isTransient(null)).toBe(false);
    expect(isTransient(undefined)).toBe(false);
  });
});

describe('CustomHandler', () => {
  function createFastifyMock() {
    return {
      setNotFoundHandler: vi.fn(),
      setErrorHandler: vi.fn(),
    };
  }

  it('registers handlers 404 and other errors', () => {
    const fastify = createFastifyMock();

    CustomHandler(fastify);

    expect(fastify.setNotFoundHandler).toHaveBeenCalledTimes(1);
    expect(fastify.setErrorHandler).toHaveBeenCalledTimes(1);
  });

  it('return 404 for unknown route', () => {
    const fastify = createFastifyMock();

    CustomHandler(fastify);

    const notFoundHandler = fastify.setNotFoundHandler.mock.calls[0][0];
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    notFoundHandler({}, reply);

    expect(reply.code).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    });
  });

  it('handle AppError with status, code and message', () => {
    const fastify = createFastifyMock();

    CustomHandler(fastify);

    const errorHandler = fastify.setErrorHandler.mock.calls[0][0];
    const error = new AppError(403, 'FORBIDDEN', 'Access denied');
    const reply = {
      headers: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    errorHandler(error, {}, reply);

    expect(reply.headers).toHaveBeenCalledWith({});
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied',
      },
    });
  });

  it('return 503 and Retry-After for temporary error', () => {
    const fastify = createFastifyMock();

    CustomHandler(fastify);

    const errorHandler = fastify.setErrorHandler.mock.calls[0][0];
    const error = { code: 'ECONNRESET' };
    const request = {
      log: { error: vi.fn() },
    };
    const reply = {
      header: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    errorHandler(error, request, reply);

    expect(request.log.error).toHaveBeenCalledWith(error);
    expect(reply.header).toHaveBeenCalledWith('Retry-After', '5');
    expect(reply.code).toHaveBeenCalledWith(503);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Storage is temporarily unavailable',
      },
    });
  });

  it('return 400 for validation error', () => {
    const fastify = createFastifyMock();

    CustomHandler(fastify);

    const errorHandler = fastify.setErrorHandler.mock.calls[0][0];
    const error = {
      validation: true,
      message: 'Invalid request',
    };
    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    errorHandler(error, {}, reply);

    expect(reply.code).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
      },
    });
  });

  it('return 500 for unexpected error', () => {
    const fastify = createFastifyMock();

    CustomHandler(fastify);

    const errorHandler = fastify.setErrorHandler.mock.calls[0][0];
    const error = new Error('Database failure');
    const request = {
      log: { error: vi.fn() },
    };
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    errorHandler(error, request, reply);

    expect(request.log.error).toHaveBeenCalledWith(error);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong',
      },
    });
  });

  it('return BAD_REQUEST for statusCode < 500', () => {
    const fastify = createFastifyMock();

    CustomHandler(fastify);

    const errorHandler = fastify.setErrorHandler.mock.calls[0][0];

    const error = {
      statusCode: 403,
      message: 'Forbidden',
    };

    const reply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    errorHandler(error, { log: { error: vi.fn() } }, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      error: {
        code: 'BAD_REQUEST',
        message: 'Forbidden',
      },
    });
  });
});
