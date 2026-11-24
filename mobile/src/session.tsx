import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { accounts, apiUrl, ApiError } from './api';
import type { Session } from './contracts';

const storageKey = 'chatsphere.session.v1';
export const demoEnabled = __DEV__;

interface SessionContextValue {
  ready: boolean;
  session: Session | null;
  demo: boolean;
  saveSession(session: Session): Promise<void>;
  signOut(): Promise<void>;
  expireToken(token: string): void;
  openDemo(): void;
  exitDemo(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function hasUsername(session: Session | null) {
  return session?.user.isUsernameSet ?? Boolean(session?.user.username);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demo, setDemo] = useState(false);
  const currentSession = useRef<Session | null>(null);
  const storageQueue = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        if (!apiUrl) return;
        const value = await SecureStore.getItemAsync(storageKey);
        if (cancelled || !value) return;
        const saved = JSON.parse(value) as { apiUrl?: string; session?: Session };
        if (saved.apiUrl === apiUrl && saved.session?.token && saved.session.user?._id) {
          currentSession.current = saved.session;
          setSession(saved.session);
        }
      } catch {
        // An unreadable session should bring the user back to sign-in.
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void restore();
    return () => { cancelled = true; };
  }, []);

  const write = useCallback((next: Session | null) => {
    const operation = storageQueue.current.catch(() => undefined).then(() => next
      ? SecureStore.setItemAsync(storageKey, JSON.stringify({ apiUrl, session: next }))
      : SecureStore.deleteItemAsync(storageKey));
    storageQueue.current = operation;
    return operation;
  }, []);

  const saveSession = useCallback(async (next: Session) => {
    await write(next);
    currentSession.current = next;
    setSession(next);
    setDemo(false);
  }, [write]);

  const signOut = useCallback(async () => {
    const token = currentSession.current?.token;
    if (token) {
      await accounts.logout(token).catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
      });
    }
    await write(null);
    currentSession.current = null;
    setSession(null);
  }, [write]);

  const expireToken = useCallback((token: string) => {
    if (currentSession.current?.token !== token) return;
    currentSession.current = null;
    setSession(null);
    void write(null).catch(() => undefined);
  }, [write]);

  return (
    <SessionContext.Provider value={{
      ready, session, demo, saveSession, signOut, expireToken,
      openDemo: () => { if (demoEnabled) setDemo(true); }, exitDemo: () => setDemo(false),
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('SessionProvider is missing.');
  return value;
}
