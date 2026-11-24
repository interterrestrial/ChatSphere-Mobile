import type { ReactNode } from 'react';
import { Inbox } from '../../components/Inbox';

export default function InboxLayout({ children }: { children: ReactNode }) {
  const assistanceEnabled = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL);
  return <Inbox assistanceEnabled={assistanceEnabled}>{children}</Inbox>;
}
