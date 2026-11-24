import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ChatService, Conversation, Message } from './chatService';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
interface ChatState {
  conversations: Conversation[];
  messages: Partial<Record<string, Message[]>>;
  inboxStatus: LoadStatus;
  inboxRequest?: string;
  latestSynced: Partial<Record<string, string>>;
  before: Partial<Record<string, string | null>>;
  syncRequests: Partial<Record<string, string>>;
  olderStatus: Partial<Record<string, LoadStatus>>;
  threadStatus: Partial<Record<string, LoadStatus>>;
}

const initialState: ChatState = {
  conversations: [], messages: {}, inboxStatus: 'idle', threadStatus: {},
  latestSynced: {}, before: {}, syncRequests: {}, olderStatus: {},
};
const chatTask = createAsyncThunk.withTypes<{ extra: ChatService; state: { chat: ChatState } }>();

export const fetchConversations = chatTask('chat/fetchConversations', (_, { extra }) => extra.conversations());
export const markConversationRead = chatTask(
  'chat/markConversationRead',
  async ({ id, messageId }: { id: string; messageId: string }, { extra, dispatch }) => {
    await extra.markRead(id, messageId);
    void dispatch(fetchConversations());
  },
);
export const fetchMessages = chatTask('chat/fetchMessages', async (id: string, { extra, getState }) => {
  const latest = getState().chat.latestSynced[id];
  if (!latest) {
    const page = await extra.messages(id);
    return { messages: page.messages, latest: page.messages.at(-1)?._id, before: page.nextCursor };
  }
  const messages: Message[] = [];
  let after: string | null = latest;
  while (after) {
    const page = await extra.messages(id, { after });
    messages.push(...page.messages);
    after = page.nextCursor;
  }
  return { messages, latest: messages.at(-1)?._id ?? latest };
});

export const fetchOlder = chatTask('chat/fetchOlder', (id: string, { extra, getState }) => {
  const before = getState().chat.before[id];
  return before ? extra.messages(id, { before }) : { messages: [], nextCursor: null };
}, { condition: (id, { getState }) => !!getState().chat.before[id] && getState().chat.olderStatus[id] !== 'loading' });
export const searchUsers = chatTask('chat/searchUsers', (query: string, { extra, signal }) => extra.search(query, signal));
export const createConversation = chatTask('chat/createConversation', (id: string, { extra }) => extra.start(id));
export const sendMessage = chatTask(
  'chat/sendMessage',
  ({ conversationId, content, clientMessageId }: { conversationId: string; content: string; clientMessageId: string },
    { extra }) => extra.send(conversationId, content, clientMessageId),
);
export const suggestReplies = chatTask('chat/suggestReplies', (message: Message, { extra }) => extra.suggest(message));
export const summarizeThread = chatTask('chat/summarize', (id: string, { extra }) => extra.summarize(id));

function sortConversations(conversations: Conversation[]) {
  conversations.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function compareMessages(a: Message, b: Message) {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt) || a._id.localeCompare(b._id);
}

function mergeMessages(current: Message[], fetched: Message[]) {
  const byId = new Map(current.map(message => [message._id, message]));
  for (const message of fetched) byId.set(message._id, message);
  return [...byId.values()].sort(compareMessages);
}

function addMessage(state: ChatState, message: Message) {
  const messages = state.messages[message.conversationId] ??= [];
  if (messages.some((item) => item._id === message._id)) return;
  messages.push(message);
  messages.sort(compareMessages);

  const conversation = state.conversations.find((item) => item._id === message.conversationId);
  if (conversation && Date.parse(message.createdAt) >= Date.parse(conversation.lastMessage?.createdAt ?? conversation.createdAt)) {
    conversation.lastMessage = message;
    conversation.updatedAt = message.createdAt;
    sortConversations(state.conversations);
  }
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    receiveMessage(state, action: PayloadAction<Message>) {
      addMessage(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state, { meta }) => {
        state.inboxRequest = meta.requestId;
        if (state.inboxStatus !== 'ready') state.inboxStatus = 'loading';
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        if (state.inboxRequest !== action.meta.requestId) return;
        state.inboxStatus = 'ready';
        state.conversations = action.payload.map((conversation) => {
          const messages = state.messages[conversation._id];
          const newest = messages?.at(-1);
          if (newest && Date.parse(newest.createdAt) > Date.parse(conversation.updatedAt)) {
            return { ...conversation, lastMessage: newest, updatedAt: newest.createdAt };
          }
          return conversation;
        });
        sortConversations(state.conversations);
      })
      .addCase(fetchConversations.rejected, (state, { meta }) => {
        if (state.inboxRequest === meta.requestId) state.inboxStatus = 'error';
      })
      .addCase(markConversationRead.fulfilled, (state, { meta }) => {
        const { id, messageId } = meta.arg;
        const conversation = state.conversations.find(({ _id }) => _id === id);
        if (conversation?.unreadMessageId === messageId) conversation.unreadMessageId = null;
      })
      .addCase(fetchMessages.pending, (state, { meta }) => {
        state.syncRequests[meta.arg] = meta.requestId;
        if (state.threadStatus[meta.arg] !== 'ready') state.threadStatus[meta.arg] = 'loading';
      })
      .addCase(fetchMessages.fulfilled, (state, { meta, payload }) => {
        if (state.syncRequests[meta.arg] !== meta.requestId) return;
        delete state.syncRequests[meta.arg];
        state.messages[meta.arg] = mergeMessages(state.messages[meta.arg] ?? [], payload.messages);
        state.latestSynced[meta.arg] = payload.latest;
        if (payload.before !== undefined) state.before[meta.arg] = payload.before;
        state.threadStatus[meta.arg] = 'ready';
      })
      .addCase(fetchMessages.rejected, (state, { meta }) => {
        if (state.syncRequests[meta.arg] !== meta.requestId) return;
        delete state.syncRequests[meta.arg];
        state.threadStatus[meta.arg] = 'error';
      })
      .addCase(fetchOlder.pending, (state, { meta }) => {
        state.olderStatus[meta.arg] = 'loading';
      })
      .addCase(fetchOlder.fulfilled, (state, { meta, payload }) => {
        state.messages[meta.arg] = mergeMessages(state.messages[meta.arg] ?? [], payload.messages);
        state.before[meta.arg] = payload.nextCursor;
        state.olderStatus[meta.arg] = 'ready';
      })
      .addCase(fetchOlder.rejected, (state, { meta }) => {
        state.olderStatus[meta.arg] = 'error';
      })
      .addCase(createConversation.fulfilled, (state, { payload }) => {
        if (!state.conversations.some(({ _id }) => _id === payload._id)) {
          state.conversations.unshift(payload);
        }
      })
      .addCase(sendMessage.fulfilled, (state, { payload }) => addMessage(state, payload));
  },
});

export const { receiveMessage } = chatSlice.actions;
export default chatSlice.reducer;
