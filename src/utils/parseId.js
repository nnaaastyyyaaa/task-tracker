import { AppError } from './errorHandler.js';

export function parseId(raw) {
  const id = Number(raw);
  if (
    !/^\d+$/.test(String(raw)) ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid id');
  }
  return id;
}
