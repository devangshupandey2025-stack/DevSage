import { localApiRequest } from '@devsage/local-data';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isAuthCheck = endpoint === '/auth/me' || endpoint === 'auth/me';
  const result = await localApiRequest<T>(endpoint, options);

  if (result.ok) {
    return result.data;
  }

  const status = result.error.status ?? 400;
  if (status === 401 && !isAuthCheck) {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/') {
      window.location.href = '/login';
    }
  }
  throw new ApiError(status, result.error.message);
}