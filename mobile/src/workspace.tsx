import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { createLiveChat } from './api';
import { chatReducer, initialChat, type ChatState } from './chat-state';
import type { ChatService, Conversation, Message, Person } from './contracts';
import { createDemoChat } from './demo';
import { useSession } from './session';

interface Workspace extends ChatState {
  user: Person;
  demo: boolean;
  reconnecting: boolean;
  reloadInbox(): Promise<boolean | undefined>;
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
const refreshInterval = 5000;

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
  const activeThread = useRef<string | null>(null);
  const inboxRequest = useRef<symbol | undefined>(undefined);
  const threadRequests = useRef(new Map<string, symbol>());
  const latestSynced = useRef(new Map<string, string>());
  const loadingEarlier = useRef(new Set<string>());
  const pendingReads = useRef(new Set<string>());

  const reloadInbox = useCallback(async (background = false) => {
    const request = Symbol();
    inboxRequest.current = request;
    if (!background) dispatch({ type: 'inbox-status', status: 'loading' });
    try {
      const conversations = await service.conversations();
      if (request !== inboxRequest.current) return;
      dispatch({ type: 'inbox-loaded', conversations });
      setReconnecting(false);
      return true;
    } catch {
      if (request !== inboxRequest.current) return;
      dispatch({ type: 'inbox-status', status: 'error' });
      setReconnecting(true);
      return false;
    } finally {
      if (request === inboxRequest.current) inboxRequest.current = undefined;
    }
  }, [service]);

  const reloadThread = useCallback(async (id: string, background = false) => {
    const requests = threadRequests.current;
    const request = Symbol();
    requests.set(id, request);
    if (!background) dispatch({ type: 'thread-status', id, status: 'loading' });
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
    } finally {
      if (requests.get(id) === request) requests.delete(id);
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
    const id = activeThread.current;
    if (!id || AppState.currentState !== 'active') return;
    const messageId = state.conversations.find((conversation) => conversation._id === id)?.unreadMessageId;
    const messages = state.threads[id]?.messages;
    const pending = pendingReads.current;
    if (!messageId || !messages?.length || pending.has(messageId)) return;
    const loaded = messages[0]._id > messageId || messages.some(({ _id }) => _id === messageId);
    if (!loaded) return;
    pending.add(messageId);
    void service.markRead(id, messageId).then(() => {
      dispatch({ type: 'conversation-read', id, messageId });
      void reloadInbox(true);
    }).catch(() => {
      // The next inbox or thread refresh retries the read.
    }).finally(() => pending.delete(messageId));
  }, [state.conversations, state.threads, reloadInbox, service]);

  useEffect(() => {
    if (demo) {
      void reloadInbox();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let pending = false;
    let interval = refreshInterval;

    async function sync() {
      if (stopped || pending || AppState.currentState === 'background') return;
      pending = true;
      clearTimeout(timer);
      const id = activeThread.current;
      const [inbox] = await Promise.all([
        !inboxRequest.current ? reloadInbox(true) : undefined,
        id && !threadRequests.current.has(id) ? reloadThread(id, true) : undefined,
      ]);
      pending = false;
      if (stopped || AppState.currentState !== 'active') return;
      interval = inbox === false ? Math.min(interval * 2, 30_000) : refreshInterval;
      timer = setTimeout(() => void sync(), interval);
    }

    void sync();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') void sync();
      else clearTimeout(timer);
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [demo, reloadInbox, reloadThread]);

  async function start(person: string) {
    const conversation = await service.start(person);
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
