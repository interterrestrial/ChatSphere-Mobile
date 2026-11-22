import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice';
import chat from './chatSlice';
import { liveChat, type ChatService } from './chatService';

export function makeStore(service: ChatService = liveChat) {
  return configureStore({
    reducer: { auth, chat },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: { extraArgument: service } }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
