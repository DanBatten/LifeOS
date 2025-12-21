import type { Metadata } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { FloatingChatBar } from '@/components/chat/FloatingChatBar';
import { Providers } from '@/providers';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400'],
});

export const metadata: Metadata = {
  title: 'LifeOS',
  description: 'Your personal multi-agent operating system',
};

// Get timezone with fallback for build-time (when env vars may not be available)
function getTimezone(): string {
  return process.env.TIMEZONE || 'America/Los_Angeles';
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const timezone = getTimezone();

  return (
    <html lang="en">
      <body className={ibmPlexSans.className}>
        <Providers timezone={timezone} userName="Dan">
          {children}
          <FloatingChatBar />
        </Providers>
      </body>
    </html>
  );
}
