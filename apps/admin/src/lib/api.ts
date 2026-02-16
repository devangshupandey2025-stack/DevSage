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
  const isAuthRefresh = endpoint === '/auth/refresh' || endpoint === 'auth/refresh';

  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  // Silent token refresh on 401 (skip in dev — auth is bypassed)
  if (response.status === 401 && !isAuthCheck && !isAuthRefresh) {
    if (import.meta.env.DEV) {
      throw new ApiError(401, 'Unauthorized (dev bypass — no redirect)');
    }

    const refreshUrl = apiOrigin ? `${apiOrigin}/auth/refresh` : '/auth/refresh';
    const refreshRes = await fetch(refreshUrl, {
      method: 'POST',
      credentials: 'include',
    });

    if (refreshRes.ok) {
      response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } else {
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/') {
        window.location.href = '/login';
      }
      throw new ApiError(401, 'Unauthorized');
    }
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
