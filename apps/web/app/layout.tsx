import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { FloatingChatBar } from '@/components/chat/FloatingChatBar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LifeOS',
  description: 'Your personal multi-agent operating system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <FloatingChatBar />
      </body>
    </html>
  );
}
