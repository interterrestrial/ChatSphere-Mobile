import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ChatService, Conversation, Message } from './chatService';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
interface ChatState {
  conversations: Conversation[];
  messages: Partial<Record<string, Message[]>>;
  inboxStatus: LoadStatus;
  threadStatus: Partial<Record<string, LoadStatus>>;
}

const initialState: ChatState = { conversations: [], messages: {}, inboxStatus: 'idle', threadStatus: {} };
const chatTask = createAsyncThunk.withTypes<{ extra: ChatService }>();

export const fetchConversations = chatTask('chat/fetchConversations', (_, { extra }) => extra.conversations());
export const fetchMessages = chatTask('chat/fetchMessages', (id: string, { extra }) => extra.messages(id));
export const searchUsers = chatTask('chat/searchUsers', (query: string, { extra, signal }) => extra.search(query, signal));
export const createConversation = chatTask('chat/createConversation', (id: string, { extra }) => extra.start(id));
export const sendMessage = chatTask(
  'chat/sendMessage',
  ({ conversationId, content }: { conversationId: string; content: string }, { extra }) => extra.send(conversationId, content),
);
export const suggestReplies = chatTask('chat/suggestReplies', (message: Message, { extra }) => extra.suggest(message));
export const summarizeThread = chatTask('chat/summarize', (id: string, { extra }) => extra.summarize(id));

function sortConversations(conversations: Conversation[]) {
  conversations.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function addMessage(state: ChatState, message: Message) {
  const messages = state.messages[message.conversationId] ??= [];
  if (messages.some((item) => item._id === message._id)) return;
  messages.push(message);
  messages.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

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
    markConversationRead(state, action: PayloadAction<string>) {
      const conversation = state.conversations.find(({ _id }) => _id === action.payload);
      if (conversation) conversation.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => {
        if (state.inboxStatus !== 'ready') state.inboxStatus = 'loading';
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.inboxStatus = 'ready';
        state.conversations = action.payload.map((conversation) => {
          const messages = state.messages[conversation._id];
          const newest = messages?.at(-1);
          const previous = state.conversations.find(({ _id }) => _id === conversation._id);
          const unreadCount = previous?.unreadCount === 0 ? 0 : conversation.unreadCount;
          if (newest && Date.parse(newest.createdAt) > Date.parse(conversation.updatedAt)) {
            return { ...conversation, unreadCount, lastMessage: newest, updatedAt: newest.createdAt };
          }
          return { ...conversation, unreadCount };
        });
        sortConversations(state.conversations);
      })
      .addCase(fetchConversations.rejected, (state) => {
        state.inboxStatus = 'error';
      })
      .addCase(fetchMessages.pending, (state, { meta }) => {
        if (state.threadStatus[meta.arg] !== 'ready') state.threadStatus[meta.arg] = 'loading';
      })
      .addCase(fetchMessages.fulfilled, (state, { meta, payload }) => {
        const byId = new Map(payload.map((message) => [message._id, message]));
        for (const message of state.messages[meta.arg] ?? []) {
          if (!byId.has(message._id)) byId.set(message._id, message);
        }
        state.messages[meta.arg] = [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        state.threadStatus[meta.arg] = 'ready';
      })
      .addCase(fetchMessages.rejected, (state, { meta }) => {
        state.threadStatus[meta.arg] = 'error';
      })
      .addCase(createConversation.fulfilled, (state, { payload }) => {
        if (!state.conversations.some(({ _id }) => _id === payload._id)) {
          state.conversations.unshift(payload);
        }
      })
      .addCase(sendMessage.fulfilled, (state, { payload }) => addMessage(state, payload));
  },
});

export const { receiveMessage, markConversationRead } = chatSlice.actions;
export default chatSlice.reducer;
