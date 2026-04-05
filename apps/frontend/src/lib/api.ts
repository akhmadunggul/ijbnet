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
  return config;
});

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
        const res = await axios.post<{ accessToken: string }>(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        );
        const { accessToken } = res.data;
        const store = useAuthStore.getState();
        if (store.user) store.login(accessToken, store.user);
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
