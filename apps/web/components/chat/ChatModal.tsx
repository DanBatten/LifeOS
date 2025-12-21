'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatContextConfig } from '@/lib/chat-context';
import { ChatActions, type ChatAction } from './ChatActions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentId?: string;
  actions?: ChatAction[];
  timestamp: Date;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage?: string;
  /** API context type for backend routing */
  context?: 'default' | 'training' | 'post-run' | 'health' | 'planning';
  /** Full context config for UI customization */
  contextConfig?: ChatContextConfig;
  /** Callback when data has been updated (e.g., workout synced) */
  onDataUpdated?: () => void;
}

const LOADING_MESSAGES = [
  "Thinking...",
  "Analyzing your data...",
  "Finding the right expert...",
];

const getAgentLabel = (agentId?: string) => {
  switch (agentId) {
    case 'health-agent':
      return 'Health & Recovery';
    case 'training-coach':
      return 'Training Coach';
    case 'workload-agent':
      return 'Workload & Focus';
    case 'reflection-agent':
      return 'Reflection';
    default:
      return 'LifeOS';
  }
};

export function ChatModal({ isOpen, onClose, initialMessage, context = 'default', contextConfig, onDataUpdated }: ChatModalProps) {
  // Derive UI text from context config, with fallbacks
  const emptyStateTitle = contextConfig?.emptyStateTitle || (context === 'post-run' ? 'How was your run?' : 'How can I help?');
  const emptyStateSubtitle = contextConfig?.emptyStateSubtitle || (context === 'post-run'
    ? "Tell me about your run and I'll sync your Garmin data, analyze your performance, and update your training notes."
    : 'Ask about your health metrics, training plan, recovery status, or get personalized recommendations.');
  const headerTitle = contextConfig?.type === 'post-run' ? 'Post-Run Check-in'
    : contextConfig?.type === 'health' ? 'Health Advisor'
    : contextConfig?.type === 'planning' ? 'Planning Assistant'
    : contextConfig?.type === 'training' ? 'Run Coach'
    : 'LifeOS Chat';

  // Suggestions based on context type
  const suggestions = context === 'post-run' || contextConfig?.type === 'post-run'
    ? ["Just finished my run!", "Felt great today", "Struggled with today's workout"]
    : context === 'training' || contextConfig?.type === 'training'
    ? ["What’s my next workout?", "How should I pace today?", "Am I recovering well?"]
    : context === 'health' || contextConfig?.type === 'health'
    ? ["How's my recovery today?", "Analyze my sleep this week", "Am I overtrained?"]
    : context === 'planning' || contextConfig?.type === 'planning'
    ? ["What should I focus on today?", "Help me plan my week", "What tasks are priority?"]
    : ["How's my recovery today?", "Should I run today?", "What's my training load?"];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialMessageSent = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage]);

  useEffect(() => {
    if (!isOpen) {
      initialMessageSent.current = false;
    }
  }, [isOpen]);

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLoadingMessage(null);

    let messageIndex = 0;
    loadingTimerRef.current = setTimeout(function showNextMessage() {
      setLoadingMessage(LOADING_MESSAGES[messageIndex]);
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      loadingTimerRef.current = setTimeout(showNextMessage, 3000);
    }, 2000);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, context }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.sessionId) setSessionId(data.sessionId);

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response,
          agentId: data.agentId,
          actions: Array.isArray(data.actions) ? (data.actions as ChatAction[]) : undefined,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // If the backend indicates data changed, let the parent refresh.
        if (data.dataUpdated && onDataUpdated) {
          onDataUpdated();
        }
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setIsLoading(false);
      setLoadingMessage(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#fafafa] dark:bg-[#0a0a0a]"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#D4E157] flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {headerTitle}
            </h2>
            {sessionId && (
              <span className="text-xs text-gray-500">Session {sessionId.slice(0, 8)}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
          aria-label="Close chat"
        >
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#D4E157] mx-auto mb-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {contextConfig?.type === 'post-run' || contextConfig?.type === 'training' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  ) : contextConfig?.type === 'health' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  ) : contextConfig?.type === 'planning' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  )}
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {emptyStateTitle}
              </h3>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                {emptyStateSubtitle}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className="px-4 py-2 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-700 hover:border-[#D4E157] hover:bg-[#D4E157]/10 transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-[#1a1a1a] text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
                }`}
              >
                {message.role === 'assistant' && message.agentId && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-[#D4E157] flex items-center justify-center">
                      <span className="text-[10px] font-bold text-gray-900">
                        {getAgentLabel(message.agentId).charAt(0)}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-[#D4E157]">
                      {getAgentLabel(message.agentId)}
                    </span>
                  </div>
                )}
                {message.role === 'assistant' ? (
                  <>
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1 prose-li:my-0.5">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    <ChatActions
                      actions={message.actions}
                      disabled={isLoading}
                      onSelect={(a) => sendMessage(a.command)}
                      tone="default"
                    />
                  </>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                )}
                <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-gray-400' : 'text-gray-500'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-[#D4E157] rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-[#D4E157] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-[#D4E157] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                  {loadingMessage && (
                    <span className="text-sm text-gray-500 animate-pulse">{loadingMessage}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 px-2 py-2 focus-within:ring-2 focus-within:ring-[#D4E157]/50 focus-within:border-[#D4E157]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none px-3 py-2 text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1a1a1a] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
