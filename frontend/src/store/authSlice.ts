import { createAsyncThunk, createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import api, { getErrorMessage } from '../api';

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
}

function accountAction<Payload>(action: string, path: string, errorMessage: string) {
  return createAsyncThunk<User, Payload, { rejectValue: string }>(
    `auth/${action}`,
    async (payload, { rejectWithValue }) => {
      try {
        const { data } = await api.post<Session>(path, payload);
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
export const googleAuthUser = accountAction<{ idToken: string }>(
  'google', '/auth/google', 'Could not sign in with Google. Try again.',
);
export const chooseUsername = accountAction<{ username: string }>(
  'username', '/auth/choose-username', 'Could not save your username. Try again.',
);

export async function restoreUser() {
  // Clear persisted credentials from the previous browser session format.
  try {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('user');
  } catch {
    // Cookie-backed sessions work even when browser storage is unavailable.
  }
  try {
    return (await api.get<Session>('/auth/session')).data.user;
  } catch {
    return null;
  }
}

export const signOut = createAsyncThunk<null, void, { rejectValue: string }>(
  'auth/signOut',
  async (_, { rejectWithValue }) => {
    try {
      await api.post('/auth/logout', {});
      return null;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, 'Could not sign out. Try again.'));
    }
  },
);

const authActions = [loginUser, registerUser, googleAuthUser, chooseUsername, signOut] as const;

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
