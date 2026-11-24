'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { ArrowRight } from 'lucide-react';
import { AccountFrame } from './AccountFrame';
import { clearAuthError, googleAuthUser, loginUser, registerUser } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/Providers';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function GoogleButton({ disabled, onError }: { disabled: boolean; onError: () => void }) {
  const dispatch = useAppDispatch();
  if (disabled) return <span role="status">Preparing sign-in…</span>;
  return <GoogleLogin onSuccess={({ credential }) => {
    if (credential) void dispatch(googleAuthUser({ idToken: credential }));
    else onError();
  }} onError={onError} text="continue_with" />;
}

export default function AuthPage() {
  const { user, ready, pending, error } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [registering, setRegistering] = useState(false);
  const [googleError, setGoogleError] = useState(false);

  useEffect(() => {
    if (ready && user) {
      const next = new URLSearchParams(window.location.search).get('next');
      const returnTo = next && /^\/c\/[\w-]+$/.test(next) ? next : '/';
      const hasUsername = user.isUsernameSet ?? Boolean(user.username);
      router.replace(hasUsername ? returnTo : '/choose-username');
    }
  }, [ready, user, router]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const identifier = String(fields.get('identifier')).trim();
    const password = String(fields.get('password'));
    setGoogleError(false);
    if (registering) {
      void dispatch(registerUser({ name: String(fields.get('name')).trim(), email: identifier, password }));
    } else {
      void dispatch(loginUser({ identifier, password }));
    }
  }

  return (
    <AccountFrame>
      <h1>{registering ? 'Create an account' : 'Sign in'}</h1>
      <p className="account-description">
        {registering ? 'Start a conversation on ChatSphere.' : 'Continue to your ChatSphere inbox.'}
      </p>
      {GOOGLE_CLIENT_ID && (
        <>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <GoogleButton disabled={pending || !ready} onError={() => setGoogleError(true)} />
          </GoogleOAuthProvider>
          <div className="form-divider"><span>or use email</span></div>
        </>
      )}
      <form className="account-fields" onSubmit={onSubmit} key={String(registering)}>
        {registering && (
          <label>Full name<input name="name" autoComplete="name" maxLength={80} required /></label>
        )}
        <label>
          {registering ? 'Email address' : 'Email or username'}
          <input
            name="identifier"
            type={registering ? 'email' : 'text'}
            autoComplete={registering ? 'email' : 'username'}
            autoCapitalize="none"
            required
          />
        </label>
        <div className="account-field">
          <label>
            Password
            <input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
              minLength={registering ? 8 : undefined} aria-describedby={registering ? 'password-help' : undefined} required />
          </label>
          {registering && <span className="muted" id="password-help">Use at least 8 characters</span>}
        </div>
        {(error || googleError) && <p className="form-error" role="alert">{error || 'Google sign-in could not start. Try again.'}</p>}
        <button className="button button--primary account-submit" type="submit" disabled={pending || !ready}>
          {pending ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="account-switch">
        {registering ? 'Already have an account?' : 'New to ChatSphere?'}{' '}
        <button type="button" className="text-button" disabled={pending} onClick={() => {
          dispatch(clearAuthError());
          setGoogleError(false);
          setRegistering(!registering);
        }}>{registering ? 'Sign in' : 'Create an account'}</button>
      </p>
    </AccountFrame>
  );
}
