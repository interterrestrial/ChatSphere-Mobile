import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io } from 'socket.io-client';
import { accounts, apiUrl, ApiError, createLiveChat } from './api';
import { chatReducer, initialChat, type ChatState } from './chat-state';
import type { ChatService, Conversation, Message, Person } from './contracts';
import { createDemoChat } from './demo';
import { useSession } from './session';

interface Workspace extends ChatState {
  user: Person;
  demo: boolean;
  reconnecting: boolean;
  reloadInbox(): Promise<void>;
  reloadThread(id: string): Promise<void>;
  loadEarlier(id: string, before: string): Promise<void>;
  focusThread(id: string): () => void;
  search: ChatService['search'];
  start(person: string): Promise<Conversation>;
  send(id: string, content: string, clientMessageId: string): Promise<void>;
  suggest: ChatService['suggest'];
  summarize: ChatService['summarize'];
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children, user, demo, token }: {
  children: ReactNode;
  user: Person;
  demo: boolean;
  token?: string;
}) {
  const { expireToken } = useSession();
  const service = useMemo(() => {
    if (demo) return createDemoChat();
    if (!token) throw new Error('A token is required for live chat.');
    return createLiveChat(token, () => expireToken(token));
  }, [demo, token, expireToken]);
  const [state, dispatch] = useReducer(chatReducer, initialChat);
  const [reconnecting, setReconnecting] = useState(false);
  const knownIds = useRef(new Set<string>());
  const activeThread = useRef<string | null>(null);
  const inboxRequest = useRef(0);
  const threadRequests = useRef(new Map<string, number>());
  const latestSynced = useRef(new Map<string, string>());
  const loadingEarlier = useRef(new Set<string>());

  const reloadInbox = useCallback(async () => {
    const request = ++inboxRequest.current;
    dispatch({ type: 'inbox-status', status: 'loading' });
    try {
      const conversations = await service.conversations();
      if (request !== inboxRequest.current) return;
      knownIds.current = new Set(conversations.map(({ _id }) => _id));
      dispatch({ type: 'inbox-loaded', conversations });
    } catch {
      if (request === inboxRequest.current) dispatch({ type: 'inbox-status', status: 'error' });
    }
  }, [service]);

  const reloadThread = useCallback(async (id: string) => {
    const requests = threadRequests.current;
    const request = (requests.get(id) ?? 0) + 1;
    requests.set(id, request);
    dispatch({ type: 'thread-status', id, status: 'loading' });
    try {
      const latest = latestSynced.current.get(id);
      let after: string | null = latest ?? null;
      let before: string | null | undefined;
      const messages: Message[] = [];
      if (!latest) {
        const page = await service.messages(id);
        before = page.nextCursor;
        messages.push(...page.messages);
      }
      while (after && requests.get(id) === request) {
        const page = await service.messages(id, { after });
        messages.push(...page.messages);
        after = page.nextCursor;
      }
      if (requests.get(id) !== request) return;
      const newest = messages.at(-1);
      if (newest) latestSynced.current.set(id, newest._id);
      dispatch({ type: 'thread-loaded', id, messages, before });
    } catch {
      if (requests.get(id) === request) dispatch({ type: 'thread-status', id, status: 'error' });
    }
  }, [service]);

  async function loadEarlier(id: string, before: string) {
    if (loadingEarlier.current.has(id)) return;
    loadingEarlier.current.add(id);
    dispatch({ type: 'older-status', id, status: 'loading' });
    try {
      const page = await service.messages(id, { before });
      dispatch({ type: 'older-loaded', id, messages: page.messages, before: page.nextCursor });
    } catch {
      dispatch({ type: 'older-status', id, status: 'error' });
    } finally {
      loadingEarlier.current.delete(id);
    }
  }

  const focusThread = useCallback((id: string) => {
    activeThread.current = id;
    void reloadThread(id);
    return () => {
      if (activeThread.current === id) activeThread.current = null;
    };
  }, [reloadThread]);

  useEffect(() => {
    void reloadInbox();
    if (demo || !token) return;

    let retry: ReturnType<typeof setTimeout> | undefined;
    const socket = io(apiUrl, {
      autoConnect: false,
      auth: (callback) => {
        void accounts.socketTicket(token).then(
          ({ token: ticket }) => callback({ token: ticket }),
          (error: unknown) => {
            if (error instanceof ApiError && error.status === 401) expireToken(token);
            callback({});
          },
        );
      },
    });
    const reconnect = () => {
      clearTimeout(retry);
      if (AppState.currentState !== 'background') retry = setTimeout(() => socket.connect(), 3000);
    };
    const stale = () => setReconnecting(true);
    const refresh = () => {
      clearTimeout(retry);
      setReconnecting(false);
      void reloadInbox();
      if (activeThread.current) void reloadThread(activeThread.current);
    };

    socket.on('ready', refresh);
    socket.on('disconnect', (reason) => {
      stale();
      if (reason === 'io server disconnect') reconnect();
    });
    socket.on('connect_error', () => {
      stale();
      if (!socket.active) reconnect();
    });
    socket.on('newMessage', (message: Message) => {
      dispatch({ type: 'message', message });
      if (!knownIds.current.has(message.conversationId)) void reloadInbox();
    });
    if (AppState.currentState !== 'background') socket.connect();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') {
        if (socket.connected) refresh();
        else socket.connect();
      } else if (status === 'background') {
        clearTimeout(retry);
        socket.disconnect();
      }
    });
    return () => {
      clearTimeout(retry);
      subscription.remove();
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [demo, token, expireToken, reloadInbox, reloadThread]);

  async function start(person: string) {
    const conversation = await service.start(person);
    knownIds.current.add(conversation._id);
    dispatch({ type: 'conversation-started', conversation });
    void reloadInbox();
    return conversation;
  }

  async function send(id: string, content: string, clientMessageId: string) {
    dispatch({ type: 'message', message: await service.send(id, content, clientMessageId) });
  }

  return (
    <WorkspaceContext.Provider value={{
      ...state, user, demo, reconnecting, reloadInbox, reloadThread, loadEarlier, focusThread,
      search: service.search, start, send, suggest: service.suggest, summarize: service.summarize,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('WorkspaceProvider is missing.');
  return value;
}
