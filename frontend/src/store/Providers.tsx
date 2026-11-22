'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { SESSION_EXPIRED } from '../api';
import { boot, clearSession, restoreUser } from './authSlice';
import { makeDemoChat } from './demoChat';
import { makeStore, type AppDispatch, type RootState } from '.';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export function AppProviders({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  useEffect(() => {
    store.dispatch(boot(restoreUser()));
    const expire = () => {
      clearSession();
      store.dispatch(boot(null));
    };
    window.addEventListener(SESSION_EXPIRED, expire);
    return () => window.removeEventListener(SESSION_EXPIRED, expire);
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}

export function ChatProvider({ children, demo }: { children: ReactNode; demo: boolean }) {
  const [store] = useState(() => makeStore(demo ? makeDemoChat() : undefined));
  return <Provider store={store}>{children}</Provider>;
}
