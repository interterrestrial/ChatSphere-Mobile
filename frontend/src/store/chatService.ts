import api from '../api';

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Participant {
  _id: string;
  name: string;
  username?: string;
}

export interface Conversation {
  _id: string;
  title: string | null;
  isGroup: boolean;
  participants: Participant[];
  lastMessage: Message | null;
  createdAt: string;
  updatedAt: string;
  unreadCount?: number;
}

export interface ChatService {
  conversations(): Promise<Conversation[]>;
  messages(conversationId: string): Promise<Message[]>;
  search(query: string, signal: AbortSignal): Promise<Participant[]>;
  start(participantId: string): Promise<Conversation>;
  send(conversationId: string, content: string): Promise<Message>;
  suggest(message: Message): Promise<string[]>;
  summarize(conversationId: string): Promise<string>;
}

export const liveChat: ChatService = {
  async conversations() {
    return (await api.get<Conversation[]>('/chat/conversations')).data;
  },
  async messages(conversationId) {
    return (await api.get<Message[]>(`/chat/messages/${encodeURIComponent(conversationId)}`)).data;
  },
  async search(query, signal) {
    const path = query ? '/chat/users/search' : '/chat/users';
    return (await api.get<Participant[]>(path, { params: { q: query }, signal })).data;
  },
  async start(participantId) {
    return (await api.post<Conversation>('/chat/conversations', { participantId })).data;
  },
  async send(conversationId, content) {
    return (await api.post<Message>('/chat/messages', { conversationId, content })).data;
  },
  async suggest(message) {
    const { data } = await api.post<{ replies: string[] }>('/chat/smart-replies', { messageContent: message.content });
    return data.replies;
  },
  async summarize(conversationId) {
    return (await api.get<{ summary: string }>(`/chat/summary/${encodeURIComponent(conversationId)}`)).data.summary;
  },
};
