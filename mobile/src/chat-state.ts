import type { Conversation, Message } from './contracts';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface ChatState {
  conversations: Conversation[];
  inboxStatus: LoadStatus;
  threads: Record<string, {
    messages: Message[]; status: LoadStatus; before?: string | null; olderStatus?: LoadStatus;
  } | undefined>;
}

export const initialChat: ChatState = {
  conversations: [],
  inboxStatus: 'loading',
  threads: {},
};

export type ChatAction =
  | { type: 'inbox-status'; status: LoadStatus }
  | { type: 'inbox-loaded'; conversations: Conversation[] }
  | { type: 'thread-status'; id: string; status: LoadStatus }
  | { type: 'thread-loaded'; id: string; messages: Message[]; before?: string | null }
  | { type: 'older-status'; id: string; status: LoadStatus }
  | { type: 'older-loaded'; id: string; messages: Message[]; before: string | null }
  | { type: 'conversation-started'; conversation: Conversation }
  | { type: 'message'; message: Message };

const descending = (a: Conversation, b: Conversation) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
const ascending = (a: Message, b: Message) =>
  Date.parse(a.createdAt) - Date.parse(b.createdAt) || a._id.localeCompare(b._id);

function mergeMessages(existing: Message[], fetched: Message[]) {
  const byId = new Map(existing.map((message) => [message._id, message]));
  fetched.forEach((message) => byId.set(message._id, message));
  return [...byId.values()].sort(ascending);
}

function withLatest(conversation: Conversation, message?: Message) {
  if (!message) return conversation;
  const latest = conversation.lastMessage;
  if (latest && ascending(latest, message) >= 0) return conversation;
  const updatedAt = Date.parse(message.createdAt) < Date.parse(conversation.updatedAt)
    ? conversation.updatedAt : message.createdAt;
  return { ...conversation, lastMessage: message, updatedAt };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'inbox-status':
      return { ...state, inboxStatus: action.status };
    case 'inbox-loaded':
      return {
        ...state,
        inboxStatus: 'ready',
        conversations: action.conversations
          .map((conversation) => withLatest(conversation, state.threads[conversation._id]?.messages.at(-1)))
          .sort(descending),
      };
    case 'thread-status': {
      const thread = state.threads[action.id] ?? { messages: [] };
      return { ...state, threads: { ...state.threads, [action.id]: { ...thread, status: action.status } } };
    }
    case 'thread-loaded': {
      const current = state.threads[action.id];
      const messages = mergeMessages(current?.messages ?? [], action.messages);
      const before = action.before === undefined ? current?.before : action.before;
      return { ...state, threads: { ...state.threads, [action.id]: { ...current, messages, before, status: 'ready' } } };
    }
    case 'older-status': {
      const current = state.threads[action.id];
      if (!current) return state;
      return { ...state, threads: { ...state.threads, [action.id]: { ...current, olderStatus: action.status } } };
    }
    case 'older-loaded': {
      const current = state.threads[action.id];
      if (!current) return state;
      const messages = mergeMessages(current.messages, action.messages);
      return { ...state, threads: { ...state.threads, [action.id]: { ...current, messages, before: action.before, olderStatus: 'ready' } } };
    }
    case 'conversation-started':
      return {
        ...state,
        conversations: state.conversations.some(({ _id }) => _id === action.conversation._id)
          ? state.conversations : [action.conversation, ...state.conversations].sort(descending),
      };
    case 'message': {
      const { message } = action;
      const current = state.threads[message.conversationId];
      if (current?.messages.some(({ _id }) => _id === message._id)) return state;
      const thread = { ...current, messages: mergeMessages(current?.messages ?? [], [message]), status: current?.status ?? 'loading' };
      return {
        ...state,
        conversations: state.conversations.map((conversation) => conversation._id === message.conversationId
          ? withLatest(conversation, message) : conversation).sort(descending),
        threads: { ...state.threads, [message.conversationId]: thread },
      };
    }
  }
}
