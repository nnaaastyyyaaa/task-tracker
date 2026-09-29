import { describe, expect, test } from 'vitest';
import { app } from '../src/app';

describe('health check', () => {
  test('returns OK status', async () => {
    const fastify = app();
    const response = await fastify.inject({
      method: 'GET',
      url: 'http://127.0.0.1:3000/health',
    });
    expect(response.json()).toEqual({ status: 'OK' });
  });
});
