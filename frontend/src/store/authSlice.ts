import { createAsyncThunk, createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import api, { getErrorMessage, readToken } from '../api';

export interface User {
  _id: string;
  name: string;
  email: string;
  username?: string;
  isUsernameSet?: boolean;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  pending: boolean;
  error: string | null;
}

const initialState: AuthState = { user: null, ready: false, pending: false, error: null };

interface Session {
  user: User;
  token: string;
}

function accountAction<Payload>(action: string, path: string, errorMessage: string) {
  return createAsyncThunk<User, Payload, { rejectValue: string }>(
    `auth/${action}`,
    async (payload, { rejectWithValue }) => {
      try {
        const { data } = await api.post<Session>(path, payload);
        window.localStorage.setItem('token', data.token);
        window.localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      } catch (error) {
        return rejectWithValue(getErrorMessage(error, errorMessage));
      }
    },
  );
}

export const loginUser = accountAction<{ identifier: string; password: string }>(
  'login', '/auth/login', 'Could not sign in. Check your connection and try again.',
);
export const registerUser = accountAction<{ name: string; email: string; password: string }>(
  'register', '/auth/register', 'Could not create your account. Try again.',
);
export const googleAuthUser = accountAction<{ token: string }>(
  'google', '/auth/google', 'Could not sign in with Google. Try again.',
);
export const chooseUsername = accountAction<{ username: string }>(
  'username', '/auth/choose-username', 'Could not save your username. Try again.',
);

export function restoreUser() {
  try {
    const serialized = window.localStorage.getItem('user');
    if (!readToken() || !serialized) return null;
    const user: User | null = JSON.parse(serialized);
    return user && typeof user._id === 'string' && typeof user.name === 'string' ? user : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  window.localStorage.removeItem('token');
  window.localStorage.removeItem('user');
}

const authActions = [loginUser, registerUser, googleAuthUser, chooseUsername] as const;

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    boot(state, action: PayloadAction<User | null>) {
      state.ready = true;
      state.user = action.payload;
      state.pending = false;
      state.error = null;
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(isAnyOf(...authActions.map((action) => action.pending)), (state) => {
      state.pending = true;
      state.error = null;
    });
    builder.addMatcher(isAnyOf(...authActions.map((action) => action.fulfilled)), (state, action) => {
      state.user = action.payload;
      state.pending = false;
    });
    builder.addMatcher(isAnyOf(...authActions.map((action) => action.rejected)), (state, action) => {
      state.pending = false;
      state.error = action.payload || 'Something went wrong. Try again.';
    });
  },
});

export const { boot, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
