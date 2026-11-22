'use client';

import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { LogOut, MessageSquare } from 'lucide-react';
import { connectChat } from '../api/socket';
import { boot, clearSession } from '../store/authSlice';
import { demoUser } from '../store/demoChat';
import { fetchConversations, fetchMessages, markConversationRead, receiveMessage } from '../store/chatSlice';
import type { Message, Participant } from '../store/chatService';
import { ChatProvider, useAppDispatch, useAppSelector } from '../store/Providers';
import { Brand } from './Identity';
import { ChatArea } from './ChatArea';
import { Sidebar } from './Sidebar';

function Workspace({ user, demo, onLogout }: { user: Participant; demo: boolean; onLogout: () => void }) {
  const { convId } = useParams<{ convId?: string }>();
  const { conversations, inboxStatus } = useAppSelector((state) => state.chat);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const conversation = conversations.find(({ _id }) => _id === convId);
  const base = demo ? '/demo' : '';
  const inboxError = inboxStatus === 'error';
  const threadUnavailable = inboxStatus === 'ready' || inboxError;

  const refreshOnConnect = useEffectEvent(() => {
    setOffline(false);
    void dispatch(fetchConversations());
    if (convId) void dispatch(fetchMessages(convId));
  });

  const onMessage = useEffectEvent((message: Message) => {
    dispatch(receiveMessage(message));
    if (!conversations.some(({ _id }) => _id === message.conversationId)) void dispatch(fetchConversations());
  });

  useEffect(() => {
    void dispatch(fetchConversations());
    if (demo) return;
    const socket = connectChat(user._id);
    const lost = () => setOffline(true);
    socket.on('connect', refreshOnConnect);
    socket.on('disconnect', lost);
    socket.on('connect_error', lost);
    socket.on('newMessage', onMessage);
    socket.connect();

    return () => {
      socket.off('connect', refreshOnConnect);
      socket.off('disconnect', lost);
      socket.off('connect_error', lost);
      socket.off('newMessage', onMessage);
      socket.disconnect();
    };
  }, [dispatch, user._id, demo]);

  return (
    <div className="app">
      <header className="topbar">
        <Link href={base || '/'} className="brand-link" aria-label="ChatSphere inbox"><Brand /></Link>
        <div className="topbar-side">
          {demo ? <span className="demo-label">Sample inbox</span> : offline && <span className="connection-note" role="status">Reconnecting…</span>}
          {demo ? <Link href="/login" className="button button--quiet topbar-action">Exit demo <LogOut size={16} aria-hidden="true" /></Link>
            : <button type="button" className="button button--quiet topbar-action" onClick={onLogout}>Sign out <LogOut size={16} aria-hidden="true" /></button>}
        </div>
      </header>
      <main className={`workspace${convId ? ' workspace--thread' : ''}`}>
        <Sidebar user={user} activeId={convId} basePath={base} onSelect={(id) => {
          dispatch(markConversationRead(id));
          router.push(`${base}/c/${encodeURIComponent(id)}`);
        }} />
        {conversation ? <ChatArea key={conversation._id} conversation={conversation} user={user} inboxHref={base || '/'} demo={demo} />
          : (
            <section className="thread-placeholder">
              <div className="placeholder-content">
                <span className="placeholder-mark" aria-hidden="true"><MessageSquare size={26} /></span>
                <h2>{convId ? (threadUnavailable ? 'Conversation unavailable' : 'Opening conversation') : 'Choose a conversation'}</h2>
                <p>{convId && !threadUnavailable ? 'Your messages will appear here.' : 'Open a thread from the inbox to read and reply.'}</p>
                {convId && (inboxError
                  ? <button type="button" className="button button--outline" onClick={() => void dispatch(fetchConversations())}>Try again</button>
                  : <Link className="button button--outline" href={base || '/'}>Back to inbox</Link>)}
              </div>
            </section>
          )}
      </main>
    </div>
  );
}

export function Inbox({ children, demo = false }: { children: ReactNode; demo?: boolean }) {
  const { ready, user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { convId } = useParams<{ convId?: string }>();
  const hasUsername = user?.isUsernameSet ?? !!user?.username;

  useEffect(() => {
    if (demo || !ready) return;
    if (!user) {
      const next = convId ? `?next=${encodeURIComponent(`/c/${convId}`)}` : '';
      router.replace(`/login${next}`);
    } else if (!hasUsername) {
      router.replace('/choose-username');
    }
  }, [demo, ready, user, hasUsername, convId, router]);

  const account = demo ? demoUser : hasUsername && ready ? user : null;
  if (!account) {
    return <main className="session-loading"><Brand /><p role="status">Opening ChatSphere…</p></main>;
  }

  return (
    <ChatProvider key={account._id} demo={demo}>
      <Workspace demo={demo} user={account} onLogout={() => {
        clearSession();
        dispatch(boot(null));
      }} />
      {children}
    </ChatProvider>
  );
}
