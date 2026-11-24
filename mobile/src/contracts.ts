export interface Person {
  _id: string;
  name: string;
  username?: string;
}

export interface User extends Person {
  email: string;
  isUsernameSet?: boolean;
}

export interface Session {
  token: string;
  user: User;
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  title: string | null;
  isGroup: boolean;
  participants: (Person | null)[];
  lastMessage: Message | null;
  createdAt: string;
  updatedAt: string;
  unreadMessageId?: string | null;
}

export type MessageCursor = { after: string } | { before: string };
export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

export interface ChatService {
  conversations(): Promise<Conversation[]>;
  messages(id: string, cursor?: MessageCursor): Promise<MessagePage>;
  search(query: string, signal?: AbortSignal): Promise<Person[]>;
  start(personId: string): Promise<Conversation>;
  send(id: string, content: string, clientMessageId: string): Promise<Message>;
  markRead(id: string, messageId: string): Promise<void>;
  suggest(message: Message): Promise<string[]>;
  summarize(id: string): Promise<string>;
}

export function conversationPerson(conversation: Conversation, userId: string) {
  return conversation.isGroup
    ? undefined
    : conversation.participants.find((person): person is Person => !!person && person._id !== userId);
}

export function conversationTitle(conversation: Conversation, userId: string) {
  return conversationPerson(conversation, userId)?.name || conversation.title || 'Conversation';
}
