'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { LogOut, MessageSquare } from 'lucide-react';
import { signOut } from '../store/authSlice';
import { fetchConversations, fetchMessages } from '../store/chatSlice';
import type { Participant } from '../store/chatService';
import { ChatProvider, useAppDispatch, useAppSelector } from '../store/Providers';
import { Brand } from './Identity';
import { ChatArea } from './ChatArea';
import { Sidebar } from './Sidebar';

const refreshInterval = 5000;

function Workspace({ user, onLogout, logoutPending, logoutError, assistanceEnabled }: {
  user: Participant; onLogout: () => void; logoutPending: boolean; logoutError: string | null; assistanceEnabled: boolean;
}) {
  const { convId } = useParams<{ convId?: string }>();
  const { conversations, inboxStatus } = useAppSelector((state) => state.chat);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const conversation = conversations.find(({ _id }) => _id === convId);
  const inboxError = inboxStatus === 'error';
  const threadUnavailable = inboxStatus === 'ready' || inboxError;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let pending = false;
    let interval = refreshInterval;

    async function sync() {
      if (stopped || document.hidden || pending) return;
      clearTimeout(timer);
      pending = true;
      const requests = [dispatch(fetchConversations()).unwrap()];
      const results = await Promise.allSettled(convId ? [...requests, dispatch(fetchMessages(convId)).unwrap()] : requests);
      pending = false;
      if (stopped) return;
      const failed = results.every(result => result.status === 'rejected');
      setOffline(failed);
      interval = failed ? Math.min(interval * 2, 30_000) : refreshInterval;
      if (!document.hidden) timer = setTimeout(() => void sync(), interval);
    }

    function onVisibility() {
      if (document.hidden) clearTimeout(timer);
      else void sync();
    }

    void sync();
    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [dispatch, convId]);

  return (
    <div className="app">
      <header className="topbar">
        <Link href="/" className="brand-link" aria-label="ChatSphere inbox"><Brand /></Link>
        <div className="topbar-side">
          {offline && <span className="connection-note" role="status">Reconnecting…</span>}
          <button type="button" className="button button--quiet topbar-action" onClick={onLogout} disabled={logoutPending}>
            Sign out <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </header>
      {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
      <main className={`workspace${convId ? ' workspace--thread' : ''}`}>
        <Sidebar user={user} activeId={convId} basePath="" onSelect={(id) => router.push(`/c/${encodeURIComponent(id)}`)} />
        {conversation ? <ChatArea key={conversation._id} conversation={conversation} user={user} inboxHref="/" assistanceEnabled={assistanceEnabled} />
          : (
            <section className="thread-placeholder">
              <div className="placeholder-content">
                <span className="placeholder-mark" aria-hidden="true"><MessageSquare size={26} /></span>
                <h2>{convId ? (threadUnavailable ? 'Conversation unavailable' : 'Opening conversation') : 'Choose a conversation'}</h2>
                <p>{convId && !threadUnavailable ? 'Your messages will appear here.' : 'Open a thread from the inbox to read and reply.'}</p>
                {convId && (inboxError
                  ? <button type="button" className="button button--outline" onClick={() => void dispatch(fetchConversations())}>Try again</button>
                  : <Link className="button button--outline" href="/">Back to inbox</Link>)}
              </div>
            </section>
          )}
      </main>
    </div>
  );
}

export function Inbox({ children, assistanceEnabled }: { children: ReactNode; assistanceEnabled: boolean }) {
  const { ready, user, pending, error } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { convId } = useParams<{ convId?: string }>();
  const hasUsername = user?.isUsernameSet ?? !!user?.username;

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      const next = convId ? `?next=${encodeURIComponent(`/c/${convId}`)}` : '';
      router.replace(`/login${next}`);
    } else if (!hasUsername) {
      router.replace('/choose-username');
    }
  }, [ready, user, hasUsername, convId, router]);

  if (!user || !hasUsername || !ready) {
    return <main className="session-loading"><Brand /><p role="status">Opening ChatSphere…</p></main>;
  }

  return (
    <ChatProvider key={user._id}>
      <Workspace user={user} logoutPending={pending} logoutError={error} assistanceEnabled={assistanceEnabled} onLogout={() => void dispatch(signOut())} />
      {children}
    </ChatProvider>
  );
}
