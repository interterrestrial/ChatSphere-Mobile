import Link from 'next/link';
import { ArrowUpRight, Check, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, Brand } from './Identity';
import { demoThreadId } from '../store/demoChat';

export function AccountFrame({ children }: { children: ReactNode }) {
  return (
    <div className="account">
      <header className="topbar">
        <Brand />
        <Link href={`/demo/c/${demoThreadId}`} className="button button--quiet topbar-action">
          Open demo inbox <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <main className="account-grid">
        <section className="account-form">{children}</section>
        <aside className="account-preview" aria-labelledby="preview-heading">
          <div className="preview-intro">
            <h2 id="preview-heading">Pick up the conversation</h2>
            <p>Direct messages, with a little help when you need a reply.</p>
          </div>
          <div className="preview-thread">
            <div className="preview-header">
              <Avatar name="Maya Chen" id="maya" />
              <div><strong>Maya Chen</strong><span>@mayachen</span></div>
              <MessageSquare className="preview-icon" size={18} aria-hidden="true" />
            </div>
            <div className="preview-messages">
              <p className="bubble">Could you check the final layout before 4?</p>
              <p className="bubble bubble--mine">I’ll take a look this afternoon.</p>
              <span className="preview-meta"><Check size={14} aria-hidden="true" /> Sent</span>
            </div>
            <div className="preview-footer">
              <span className="reply-sample"><MessageSquare size={16} aria-hidden="true" /> Send me the final PDF.</span>
              <span className="preview-caption">Example reply suggestion</span>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
