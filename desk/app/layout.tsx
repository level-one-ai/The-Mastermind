import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Call Desk · Level One',
  description: 'The call scripts The Mastermind writes, ready to read, log and learn from.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#faf9f6' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
