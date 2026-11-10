import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from '../../src/utils/retry.js';
import { AppError } from '../../src/utils/errorHandler.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withRetry', () => {
  it('returns a result if the function executes successfully on the first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after temporary error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET' })
      .mockResolvedValue('success');

    const result = await withRetry(fn, [10]);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries with the specified delays', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET' })
      .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
      .mockResolvedValue('success');

    const result = await withRetry(fn, [10, 20]);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('not retries for not temporary error', async () => {
    const error = new Error('Invalid input');
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toBe(error);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throw AppError with status 503 after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 'ECONNRESET' });

    await expect(withRetry(fn, [])).rejects.toMatchObject({
      status: 503,
      code: 'STORAGE_UNAVAILABLE',
      message: 'Storage is unavailable',
      headers: {
        'Retry-After': '5',
      },
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('execute first attempt and retries according to the number of delays', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 'ECONNRESET' });

    await expect(withRetry(fn, [10, 20, 30])).rejects.toBeInstanceOf(AppError);

    expect(fn).toHaveBeenCalledTimes(4);
  });
});
