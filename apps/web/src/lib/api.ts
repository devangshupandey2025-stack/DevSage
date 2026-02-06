export class ApiError extends Error {
  constructor(public status: number, public message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Use relative path since we have a proxy setup in vite.config.ts
  const url = `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
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
    throw new ApiError(response.status, errorData.error || response.statusText || 'API Request Failed');
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
