import type { ReactNode } from 'react';
import { Inbox } from '../../components/Inbox';

export default function InboxLayout({ children }: { children: ReactNode }) {
  return <Inbox>{children}</Inbox>;
}
