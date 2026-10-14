import { setTimeout as sleep } from 'node:timers/promises';
import { AppError, isTransient } from './errorHandler.js';

const DELAYS_MS = [100, 200, 400];

export async function withRetry(fn, delays = DELAYS_MS) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isTransient(error)) throw error;
      if (attempt >= delays.length) {
        throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Storage is unavailable', {
          'Retry-After': '5',
        });
      }
      await sleep(delays[attempt]);
    }
  }
}
