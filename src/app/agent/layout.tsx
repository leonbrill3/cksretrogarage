import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Agent — CK Retro Garage',
  robots: { index: false, follow: false },
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen bg-ink-900 font-sans text-bone">{children}</body>
    </html>
  );
}
