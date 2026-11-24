'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { SESSION_EXPIRED } from '../api';
import { boot, restoreUser } from './authSlice';
import { makeStore, type AppDispatch, type RootState } from '.';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export function AppProviders({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  useEffect(() => {
    let active = true;
    void restoreUser().then(user => { if (active) store.dispatch(boot(user)); });
    const expire = () => {
      active = false;
      store.dispatch(boot(null));
    };
    window.addEventListener(SESSION_EXPIRED, expire);
    return () => {
      active = false;
      window.removeEventListener(SESSION_EXPIRED, expire);
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);
  return <Provider store={store}>{children}</Provider>;
}
