import { AppError } from './errorHandler.js';

const MAX_INT = 2147483647;

export const badRequest = (message) => new AppError(400, 'VALIDATION_ERROR', message);

export function checkBody(body, allowed) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object');
  }
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw badRequest(`Unknown field: ${unknown.join(', ')}`);
  return body;
}

export function str(value, name, { min = 0, max }) {
  if (typeof value !== 'string') throw badRequest(`${name}: must be a string`);
  const s = value.trim();
  if (s.length < min || s.length > max) {
    throw badRequest(`${name}: must be ${min}-${max} characters`);
  }
  return s;
}

export function checkId(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_INT) {
    throw badRequest(`${name}: must be a positive integer`);
  }
  return value;
}
