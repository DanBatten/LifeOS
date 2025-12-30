'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useRouter } from 'next/navigation';
import { ChatActions, type ChatAction } from '@/components/chat/ChatActions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
  timestamp: Date;
}

export function RunCompanionChatPanel({ timezone }: { timezone: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const hasAnyMessages = messages.length > 0;
  const SESSION_KEY = 'lifeos:run-companion:session';
  const SESSION_TTL_MS = 1000 * 60 * 60; // 1 hour

  void timezone; // kept for future greeting/time-based tone

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load (cached) auto-briefing once on mount
  useEffect(() => {
    let cancelled = false;

    function loadSessionFromStorage(): string | null {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { sessionId: string; createdAt: number };
        if (!parsed?.sessionId || !parsed?.createdAt) return null;
        if (Date.now() - parsed.createdAt > SESSION_TTL_MS) return null;
        return parsed.sessionId;
      } catch {
        return null;
      }
    }

    function clearSessionStorage() {
      try {
        localStorage.removeItem(SESSION_KEY);
      } catch {
        // ignore
      }
    }

    async function loadBriefing(forceNew: boolean) {
      try {
        if (forceNew) {
          clearSessionStorage();
          setSessionId(null);
          setMessages([]);
        } else {
          const existing = loadSessionFromStorage();
          if (existing) setSessionId(existing);
        }

        const res = await fetch('/api/companion/run-companion/briefing', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && data?.briefing) {
          setMessages([
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: data.briefing,
              timestamp: new Date(),
            },
          ]);
        }
      } catch {
        // ignore
      }
    }

    const existing = loadSessionFromStorage();
    loadBriefing(!existing);
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          sessionId,
          context: 'training',
        }),
      });

      const data = await res.json();
      if (data?.success) {
        if (data.sessionId) {
          setSessionId(data.sessionId);
          try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId: data.sessionId, createdAt: Date.now() }));
          } catch {
            // ignore
          }
        }
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.response,
            actions: Array.isArray(data.actions) ? (data.actions as ChatAction[]) : undefined,
            timestamp: new Date(),
          },
        ]);

        if (data.dataUpdated) {
          router.refresh();
        }
      } else {
        throw new Error(data?.error || 'Chat failed');
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry — I hit an error. Try again in a moment.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-black/10 bg-transparent overflow-hidden h-[calc(100vh-140px)] flex flex-col">
      <div className="px-5 py-4 border-b border-black/10 bg-transparent">
        <div className="text-[11px] font-normal tracking-widest text-black/50">COACH CHAT</div>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        {!hasAnyMessages ? (
          <div className="text-black/50 text-sm">
            Loading your run briefing…
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  m.role === 'user'
                    ? 'max-w-[85%] rounded-md bg-[#ff5a2f] text-white px-4 py-3 text-sm shadow-sm'
                    : 'max-w-[85%] rounded-md bg-transparent px-1 py-1 text-sm text-black/70'
                }
              >
                {m.role === 'assistant' ? (
                  <>
                    <div className="prose prose-sm max-w-none prose-p:my-2 prose-strong:text-black/80 prose-li:my-1">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    <ChatActions
                      actions={m.actions}
                      disabled={isLoading}
                      tone="companion"
                      onSelect={(a) => void send(a.command)}
                    />
                  </>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="p-5 border-t border-black/10 bg-transparent"
      >
        <div className="flex items-center gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything"
            className="flex-1 rounded-md border border-black/10 bg-white/60 px-4 py-3 text-sm outline-none shadow-sm focus:ring-2 focus:ring-[#ff5a2f]/30"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-[#ff5a2f] px-4 py-3 text-sm font-normal text-white disabled:opacity-60 shadow-sm"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}







