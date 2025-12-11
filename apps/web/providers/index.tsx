'use client';

import { ReactNode } from 'react';
import { TimeProvider } from './TimeProvider';

interface ProvidersProps {
  children: ReactNode;
  timezone: string;
  userName?: string;
}

/**
 * Client-side providers wrapper
 * Add all client context providers here
 */
export function Providers({ children, timezone, userName }: ProvidersProps) {
  return (
    <TimeProvider
      config={{
        timezone,
        userName,
        typicalWorkoutTime: '06:30', // TODO: Get from user preferences
      }}
    >
      {children}
    </TimeProvider>
  );
}
