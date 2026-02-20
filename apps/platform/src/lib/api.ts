export class ApiError extends Error {
  constructor(public status: number, public message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiOriginRaw = import.meta.env.VITE_API_ORIGIN as string | undefined;
  const apiOrigin = apiOriginRaw ? apiOriginRaw.replace(/\/$/, '') : undefined;
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = apiOrigin ? `${apiOrigin}${path}` : path;

  const isAuthCheck = endpoint === '/auth/me' || endpoint === 'auth/me';

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Redirect to login on 401 (Better Auth handles session renewal via cookies)
  if (response.status === 401 && !isAuthCheck) {
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || errorData.error || response.statusText || 'API Request Failed';
    throw new ApiError(response.status, message);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
