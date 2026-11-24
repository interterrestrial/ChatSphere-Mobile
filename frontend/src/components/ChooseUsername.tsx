'use client';

import { useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { AccountFrame } from './AccountFrame';
import { chooseUsername, signOut } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/Providers';

export function ChooseUsername() {
  const { user, ready, pending, error } = useAppSelector((state) => state.auth);
  const router = useRouter();
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace('/login');
    else if (user.isUsernameSet ?? !!user.username) router.replace('/');
  }, [ready, user, router]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = String(new FormData(event.currentTarget).get('username')).trim();
    void dispatch(chooseUsername({ username }));
  }

  return (
    <AccountFrame>
      <h1>Choose a username</h1>
      <p className="account-description">People can use it to find you and start a conversation.</p>
      <form className="account-fields" onSubmit={onSubmit}>
        <div className="account-field">
          <label>
            Username
            <input name="username" autoComplete="username" autoCapitalize="none" minLength={3} maxLength={20}
              pattern="[a-zA-Z0-9_]{3,20}" aria-describedby="username-help" required />
          </label>
          <span className="muted" id="username-help">3 to 20 letters, numbers, or underscores</span>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary account-submit" disabled={!user || pending}>
          {pending ? 'Saving…' : 'Go to inbox'} <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
      <p className="account-switch">
        <button type="button" className="text-button" disabled={pending} onClick={() => void dispatch(signOut())}>Back to sign in</button>
      </p>
    </AccountFrame>
  );
}
