import axios, { type InternalAxiosRequestConfig } from 'axios';

export const SESSION_EXPIRED = 'chatsphere:session-expired';

const api = axios.create({ baseURL: '/api/backend', timeout: 15000 });
const requestRevision = new WeakMap<InternalAxiosRequestConfig, number>();
let sessionRevision = 0;

const opensSession = (url?: string) => /^\/auth\/(login|register|google)$/.test(url || '');

api.interceptors.request.use((config) => {
  requestRevision.set(config, sessionRevision);
  return config;
});

api.interceptors.response.use((response) => {
  if (opensSession(response.config.url) || response.config.url === '/auth/logout') sessionRevision++;
  return response;
}, (error) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && typeof window !== 'undefined' &&
    error.config && !opensSession(error.config.url) && error.config.url !== '/auth/session' &&
    requestRevision.get(error.config) === sessionRevision) {
    window.dispatchEvent(new Event(SESSION_EXPIRED));
  }
  return Promise.reject(error);
});

export function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const status = error.response?.status;
    if (status && status < 500 && typeof error.response?.data?.message === 'string') {
      return error.response.data.message;
    }
  }
  return fallback;
}

export default api;
