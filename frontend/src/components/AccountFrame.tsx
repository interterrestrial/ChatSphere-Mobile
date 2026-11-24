import type { ReactNode } from 'react';
import { Brand } from './Identity';

export function AccountFrame({ children }: { children: ReactNode }) {
  return (
    <div className="account">
      <header className="topbar"><Brand /></header>
      <main className="account-grid">
        <section className="account-form">{children}</section>
      </main>
    </div>
  );
}
