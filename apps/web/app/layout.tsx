import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { FloatingChatBar } from '@/components/chat/FloatingChatBar';
import { Providers } from '@/providers';
import { getEnv } from '@/lib/env';

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
  const env = getEnv();
  const timezone = env.TIMEZONE;

  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers timezone={timezone} userName="Dan">
          {children}
          <FloatingChatBar />
        </Providers>
      </body>
    </html>
  );
}
