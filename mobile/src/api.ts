import type { ChatService, Conversation, Message, MessagePage, Person, Session, User } from './contracts';

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
export const googleClientId = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.status < 500 && error.message ? error.message : fallback;
}

async function request<T>(path: string, options: { token?: string; data?: object; signal?: AbortSignal } = {}): Promise<T> {
  if (!apiUrl) throw new ApiError('The API URL is not configured.', 400);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();

  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true });

  try {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
    if (options.data) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${apiUrl}/api${path}`, {
      headers,
      method: options.data ? 'POST' : 'GET',
      body: options.data ? JSON.stringify(options.data) : undefined,
      signal: controller.signal,
    });
    if (response.status === 204) return undefined as T;
    const data = await response.json().catch(() => undefined);
    if (!response.ok) throw new ApiError(typeof data?.message === 'string' ? data.message : '', response.status);
    if (data === undefined) throw new Error('The API returned an invalid response.');
    return data as T;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export const accounts = {
  login: (identifier: string, password: string) => request<Session>('/auth/login', { data: { identifier, password } }),
  register: (name: string, email: string, password: string) =>
    request<Session>('/auth/register', { data: { name, email, password } }),
  google: (idToken: string) => request<Session>('/auth/google', { data: { idToken } }),
  chooseUsername: (username: string, token: string) =>
    request<{ user: User }>('/auth/choose-username', { token, data: { username } }),
  logout: (token: string) => request<void>('/auth/logout', { token, data: {} }),
  socketTicket: (token: string) => request<{ token: string }>('/auth/socket-ticket', { token }),
};

export function createLiveChat(token: string, expire: () => void): ChatService {
  async function authenticated<T>(path: string, data?: object, signal?: AbortSignal) {
    try {
      return await request<T>(path, { token, data, signal });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) expire();
      throw error;
    }
  }

  return {
    conversations: () => authenticated<Conversation[]>('/chat/conversations'),
    messages: (id, cursor) => {
      const query = cursor ? `?${new URLSearchParams(cursor)}` : '';
      return authenticated<MessagePage>(`/chat/messages/${encodeURIComponent(id)}${query}`);
    },
    search: (query, signal) => authenticated<Person[]>(query ? `/chat/users/search?q=${encodeURIComponent(query)}` : '/chat/users', undefined, signal),
    start: (participantId) => authenticated<Conversation>('/chat/conversations', { participantId }),
    send: (conversationId, content, clientMessageId) =>
      authenticated<Message>('/chat/messages', { conversationId, content, clientMessageId }),
    async suggest(message) {
      return (await authenticated<{ replies: string[] }>('/chat/smart-replies', { conversationId: message.conversationId, messageId: message._id })).replies;
    },
    async summarize(id) {
      return (await authenticated<{ summary: string }>(`/chat/summary/${encodeURIComponent(id)}`)).summary;
    },
  };
}
