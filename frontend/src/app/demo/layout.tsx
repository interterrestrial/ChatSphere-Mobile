import type { ReactNode } from 'react';
import { Inbox } from '../../components/Inbox';

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <Inbox demo>{children}</Inbox>;
}
