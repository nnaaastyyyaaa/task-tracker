const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, path, body) {
  const hasBody = body !== undefined;

  const response = await fetch(BASE + path, {
    method,
    credentials: 'include',
    // Content-Type виставляємо лише з тілом: Fastify відхиляє JSON-запит з порожнім тілом.
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) onUnauthorized();

    const code = payload?.error?.code ?? 'UNKNOWN_ERROR';
    const message =
      response.status === 503
        ? 'Сервіс тимчасово недоступний, спробуйте за кілька секунд'
        : (payload?.error?.message ?? response.statusText);

    throw new ApiError(response.status, code, message);
  }

  return payload?.data ?? null;
}

export const api = {
  auth: {
    register: (data) => request('POST', '/auth/register', data),
    login: (data) => request('POST', '/auth/login', data),
    logout: () => request('POST', '/auth/logout'),
  },
  projects: {
    list: () => request('GET', '/projects'),
    get: (id) => request('GET', `/projects/${id}`),
    create: (data) => request('POST', '/projects', data),
    addMember: (id, email) => request('POST', `/projects/${id}/members`, { email }),
  },
  tasks: {
    list: (projectId, { mine = false } = {}) =>
      request('GET', `/projects/${projectId}/tasks${mine ? '?assignee=me' : ''}`),
    create: (projectId, data) => request('POST', `/projects/${projectId}/tasks`, data),
    update: (id, data) => request('PATCH', `/tasks/${id}`, data),
    setStatus: (id, status) => request('PATCH', `/tasks/${id}/status`, { status }),
    setAssignee: (id, assigneeId) =>
      request('PATCH', `/tasks/${id}/assignee`, { assigneeId }),
    remove: (id) => request('DELETE', `/tasks/${id}`),
  },
};
