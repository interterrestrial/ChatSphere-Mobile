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
  unreadMessageId?: string | null;
}

export type MessageCursor = { before: string } | { after: string };
export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export interface ChatService {
  conversations(): Promise<Conversation[]>;
  messages(conversationId: string, cursor?: MessageCursor): Promise<MessagePage>;
  search(query: string, signal: AbortSignal): Promise<Participant[]>;
  start(participantId: string): Promise<Conversation>;
  send(conversationId: string, content: string, clientMessageId: string): Promise<Message>;
  markRead(conversationId: string, messageId: string): Promise<void>;
  suggest(message: Message): Promise<string[]>;
  summarize(conversationId: string): Promise<string>;
}

export const liveChat: ChatService = {
  async conversations() {
    return (await api.get<Conversation[]>('/chat/conversations')).data;
  },
  async messages(conversationId, cursor) {
    return (await api.get<MessagePage>(`/chat/messages/${encodeURIComponent(conversationId)}`, { params: cursor })).data;
  },
  async search(query, signal) {
    const path = query ? '/chat/users/search' : '/chat/users';
    return (await api.get<Participant[]>(path, { params: { q: query }, signal })).data;
  },
  async start(participantId) {
    return (await api.post<Conversation>('/chat/conversations', { participantId })).data;
  },
  async send(conversationId, content, clientMessageId) {
    return (await api.post<Message>('/chat/messages', { conversationId, content, clientMessageId })).data;
  },
  async markRead(conversationId, messageId) {
    await api.post('/chat/read', { conversationId, messageId });
  },
  async suggest(message) {
    const { data } = await api.post<{ replies: string[] }>('/chat/smart-replies', { conversationId: message.conversationId, messageId: message._id });
    return data.replies;
  },
  async summarize(conversationId) {
    return (await api.get<{ summary: string }>(`/chat/summary/${encodeURIComponent(conversationId)}`)).data.summary;
  },
};
