import axios from 'axios';

export const API_HOST = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6001').replace(/\/+$/, '');
export const SESSION_EXPIRED = 'chatsphere:session-expired';

export function readToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem('token');
}

const api = axios.create({ baseURL: `${API_HOST}/api`, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = readToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(undefined, (error) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && typeof window !== 'undefined') {
    const token = readToken();
    const usesSession = !/^\/auth\/(login|register|google)$/.test(error.config?.url || '');
    if (usesSession && token && error.config?.headers.Authorization === `Bearer ${token}`) {
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
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
