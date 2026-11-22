import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from '../store/Providers';
import './styles.css';

export const metadata: Metadata = {
  title: 'ChatSphere',
  description: 'One-to-one conversations on ChatSphere',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
