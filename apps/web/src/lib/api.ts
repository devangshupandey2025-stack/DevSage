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

  if (response.status === 401 && !isAuthCheck) {
    // Only redirect if not checking auth status to avoid loops
    const currentPath = window.location.pathname;
    if (currentPath !== '/login' && currentPath !== '/') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = typeof errorData.error === 'object' && errorData.error?.message
      ? errorData.error.message
      : typeof errorData.error === 'string'
        ? errorData.error
        : response.statusText || 'API Request Failed';
    throw new ApiError(response.status, errorMessage);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
