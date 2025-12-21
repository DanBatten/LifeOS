'use client';

import { useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChatModal } from './ChatModal';
import { getChatContextForPath, getApiContextType, type ChatContextConfig } from '@/lib/chat-context';

interface FloatingChatBarProps {
  /** Override the auto-detected context config */
  contextOverride?: Partial<ChatContextConfig>;
}

export function FloatingChatBar({ contextOverride }: FloatingChatBarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | undefined>();
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Run Companion has an inline chat panel; hide the floating bar.
  if (pathname.startsWith('/run-companion') || pathname === '/') {
    return null;
  }

  // Get context configuration based on current page path
  const pageContext = getChatContextForPath(pathname);
  const contextConfig = { ...pageContext, ...contextOverride };

  // Derive values from context config
  const apiContext = getApiContextType(contextConfig);
  const placeholderText = contextConfig.placeholder;

  const handleFocus = () => {
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = inputRef.current?.value.trim();
    if (value) {
      setPendingMessage(value);
      setIsModalOpen(true);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setPendingMessage(undefined);
  };

  const handleDataUpdated = () => {
    // Refresh the current page data (server components will re-fetch)
    router.refresh();
  };

  return (
    <>
      {/* Floating Chat Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pointer-events-none">
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-gray-900 dark:via-gray-900/80" />

        <form
          onSubmit={handleSubmit}
          className="relative max-w-lg mx-auto pointer-events-auto"
        >
          <div className="
            flex items-center gap-3
            bg-[#1a1a1a] rounded-full
            shadow-2xl shadow-black/20
            px-2 py-2
            transition-all duration-300
            hover:shadow-black/30
            focus-within:ring-2 focus-within:ring-[#D4E157]/50
          ">
            {/* Lime accent button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="
                flex-shrink-0 w-10 h-10 rounded-full
                bg-[#D4E157]
                flex items-center justify-center
                transition-transform hover:scale-105
              "
            >
              <svg
                className="w-5 h-5 text-gray-900"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </button>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholderText}
              className="
                flex-1 bg-transparent text-white
                placeholder-gray-400
                focus:outline-none
                py-2 text-sm
              "
              onFocus={handleFocus}
            />

            {/* Send arrow */}
            <button
              type="submit"
              className="
                flex-shrink-0 w-10 h-10 rounded-full
                bg-white/10 hover:bg-white/20
                flex items-center justify-center
                transition-all
              "
              aria-label="Send message"
            >
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Chat Modal */}
      <ChatModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        initialMessage={pendingMessage}
        context={apiContext}
        contextConfig={contextConfig}
        onDataUpdated={handleDataUpdated}
      />
    </>
  );
}
