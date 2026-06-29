import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token (in-memory only) to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  // Remove Content-Type for FormData so axios sets it automatically
  // with the correct multipart boundary
  if (config.data instanceof FormData) {
    config.headers.delete('Content-Type');
  }
  return config;
});

// Singleton refresh promise — prevents concurrent refresh races when multiple
// 401s arrive before the first refresh completes (e.g. new tab with no accessToken
// where AuthInitializer and the first API call both trigger refresh simultaneously).
let pendingRefresh: Promise<string> | null = null;

export function doRefresh(): Promise<string> {
  if (!pendingRefresh) {
    pendingRefresh = axios
      .post<{ accessToken: string }>('/api/auth/refresh', {}, { withCredentials: true })
      .then((res) => {
        const { accessToken } = res.data;
        const store = useAuthStore.getState();
        if (store.user) store.login(accessToken, store.user);
        return accessToken;
      })
      .finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}

// On 401, attempt a silent token refresh then replay
api.interceptors.response.use(
  (r) => r,
  async (error: unknown) => {
    const err = error as {
      config?: Record<string, unknown> & { _retry?: boolean };
      response?: { status?: number };
    };
    if (err.response?.status === 401 && err.config && !err.config._retry) {
      err.config._retry = true;
      try {
        const accessToken = await doRefresh();
        if (err.config.headers && typeof err.config.headers === 'object') {
          (err.config.headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
        }
        return api(err.config as unknown as Parameters<typeof api>[0]);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  },
);
