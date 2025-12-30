'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { TimeContext } from '@/lib/time-context';
import { useRouter } from 'next/navigation';
import { ChatActions, type ChatAction } from '@/components/chat/ChatActions';

type Metric = {
  title: string;
  value: string;
  unit: string;
  badge: { text: string; tone: 'lime' | 'amber' | 'gray' | 'green' };
  subtitle?: string;
};

function Pill({ text, tone }: { text: string; tone: Metric['badge']['tone'] }) {
  const tones = {
    lime: 'bg-[#b9d56a] text-black/70',
    amber: 'bg-[#d7b23b]/90 text-black/80',
    gray: 'bg-black/10 text-black/60',
    green: 'bg-[#4cd964] text-black/70',
  } as const;

  return (
    <span className={`text-[10px] font-normal px-2 py-0.5 rounded ${tones[tone]}`}>
      {text}
    </span>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="rounded-md border border-black/10 bg-white/55 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-normal tracking-widest text-black/50">
          {metric.title.toUpperCase()}
        </div>
        <Pill text={metric.badge.text} tone={metric.badge.tone} />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div className="text-6xl leading-[1] font-normal text-black/80">{metric.value}</div>
        <div className="pb-1 text-[11px] font-normal text-black/50">{metric.unit}</div>
      </div>
      {metric.subtitle && <div className="mt-2 text-xs font-light text-black/45">{metric.subtitle}</div>}
    </div>
  );
}

export function CompanionHomeView({
  timezone,
  timeContext,
  initialBriefing,
  metrics,
  todayRun,
}: {
  timezone: string;
  timeContext: TimeContext;
  initialBriefing?: string;
  metrics: Metric[];
  todayRun: {
    title: string;
    distanceMiles: string;
    paceLabel: string;
    planLabel: string;
    shoeLabel: string;
    description: string;
  };
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string; actions?: ChatAction[] }>>(
    initialBriefing ? [{ role: 'assistant', content: initialBriefing }] : []
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const SESSION_KEY = 'lifeos:home-companion:session';
  const SESSION_TTL_MS = 1000 * 60 * 60; // 1 hour

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    // session persistence (1 hour)
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { sessionId: string; createdAt: number };
      if (!parsed?.sessionId || !parsed?.createdAt) return;
      if (Date.now() - parsed.createdAt > SESSION_TTL_MS) return;
      setSessionId(parsed.sessionId);
    } catch {
      // ignore
    }
  }, []);

  // Load (cached) auto-briefing once on mount (and show it as the first assistant message).
  useEffect(() => {
    let cancelled = false;

    async function loadBriefing() {
      try {
        const res = await fetch('/api/companion/home/briefing', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        
        if (data?.briefing) {
          setMessages([{ role: 'assistant', content: data.briefing }]);
        } else {
          // API returned but no briefing - show error details if available
          const errorInfo = data?.error ? ` (${data.error})` : '';
          setMessages([
            {
              role: 'assistant',
              content:
                `Good ${timeContext.timeOfDay}, Dan.\n\n` +
                `I couldn't generate your briefing right now${errorInfo}. Try refreshing the page or asking me a question directly.`,
            },
          ]);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Briefing] Failed to load:', err);
          setMessages([
            {
              role: 'assistant',
              content:
                `Good ${timeContext.timeOfDay}, Dan.\n\n` +
                `I'm having trouble connecting to the briefing service. Try refreshing the page.`,
            },
          ]);
        }
      }
    }

    loadBriefing();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || isLoading) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, context: 'default' }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Chat failed');

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
          role: 'assistant',
          content: data.response,
          actions: Array.isArray(data.actions) ? (data.actions as ChatAction[]) : undefined,
        },
      ]);
      if (data.dataUpdated) router.refresh();
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry — I hit an error. Try again in a moment.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const dateLabel = timeContext.dateString.toUpperCase();

  return (
    <main className="min-h-screen bg-[#e9e4dd] text-[#3a2f2a]">
      <header className="sticky top-0 z-20 border-b border-black/10 bg-gradient-to-b from-[#e9e4dd] to-[#e9e4dd]/70 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-8 py-5 flex items-center justify-between">
          <div className="text-xl font-normal italic tracking-wide">COMPANION</div>
          <div className="text-sm font-normal tracking-[0.2em] text-black/60">{dateLabel}</div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Narrative + chat */}
          <section className="col-span-12 lg:col-span-5">
            <div className="rounded-xl border border-black/10 bg-white/10 p-6 h-[calc(100vh-160px)] flex flex-col">
              <div className="flex-1 overflow-auto space-y-5 pr-2">
                {messages.map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                    <div
                      className={
                        m.role === 'user'
                          ? 'max-w-[90%] rounded-md bg-[#ff5a2f] text-white px-4 py-3 text-sm shadow-sm'
                          : 'max-w-[90%] rounded-none bg-transparent px-1 py-1 text-[18px] leading-relaxed text-black/80'
                      }
                    >
                      {m.role === 'assistant' ? (
                        <>
                          <div className="prose max-w-none font-light prose-p:my-5 prose-strong:text-black/90 prose-li:my-2 prose-ul:my-4 prose-a:text-black/70">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                          <ChatActions
                            actions={m.actions}
                            disabled={isLoading}
                            tone="companion"
                            onSelect={(a) => {
                              void send(a.command);
                            }}
                          />
                        </>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="text-sm text-black/40">Thinking…</div>
                )}
                <div ref={endRef} />
              </div>

              <div className="pt-4">
                <div className="flex items-center gap-3">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything"
                    className="flex-1 rounded-md border border-black/10 bg-white/70 px-4 py-3 text-sm outline-none shadow-sm focus:ring-2 focus:ring-[#ff5a2f]/30"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <button
                    onClick={() => void send()}
                    disabled={isLoading}
                    className="rounded-md bg-[#ff5a2f] px-4 py-3 text-sm font-normal text-white disabled:opacity-60 shadow-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Right: cards */}
          <section className="col-span-12 lg:col-span-7">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {metrics.slice(0, 4).map((m) => (
                <MetricCard key={m.title} metric={m} />
              ))}

              {/* Pre-run snack */}
              <div className="col-span-2 rounded-md border border-black/10 bg-[#cfe6d6] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold tracking-widest text-black/50">PRE-RUN SNACK</div>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-black/10 text-black/60">
                      Quick Energy
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-black/10 text-black/60">
                      Muscle Support
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex items-end justify-between gap-6">
                  <div>
                    <div className="text-7xl leading-[1] font-light text-black/70">200</div>
                    <div className="mt-1 text-sm font-semibold text-black/50">Calories</div>
                  </div>
                  <div className="text-xs text-black/60 max-w-[260px]">
                    Consider a banana and a handful of granola, or peanut butter on toast.
                  </div>
                </div>
              </div>

              {/* Today’s run */}
              <div className="col-span-2 rounded-md border border-black/10 bg-[#e5c7c2] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold tracking-widest text-black/50">TODAYS RUN</div>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#ff6b3d] text-white">
                      {todayRun.paceLabel}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#ff6b3d] text-white">
                      {todayRun.planLabel}
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex items-end justify-between gap-6">
                  <div>
                    <div className="text-7xl leading-[1] font-light text-black/70">{todayRun.distanceMiles}</div>
                    <div className="mt-1 text-sm font-semibold text-black/50">miles</div>
                  </div>
                  <div className="max-w-[280px]">
                    <div className="rounded border border-black/10 bg-white/50 p-3 text-xs text-black/60">
                      <div className="font-semibold text-black/70">{todayRun.shoeLabel}</div>
                      <div className="mt-1">{todayRun.description}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Journal */}
              <div className="col-span-2 rounded-md border border-black/10 bg-[#e6cdf7] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold tracking-widest text-black/50">JOURNAL</div>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-black/10 text-black/60">
                      Reduce Anxiety
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-black/10 text-black/60">
                      Regulate Mood
                    </span>
                  </div>
                </div>
                <div className="mt-6 rounded-sm bg-white/40 p-4 text-sm text-black/40">
                  Studies show that journalling regularly is great for reducing anxiety and stress, and regulating mood. Add an entry!
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="rounded-sm bg-[#4c2a6d] px-4 py-2 text-xs font-semibold text-white/90">
                    ADD JOURNAL ENTRY
                  </button>
                </div>
              </div>

              {/* Health tips */}
              <div className="col-span-2 rounded-md border border-black/10 bg-[#bfcdea] p-4 shadow-sm">
                <div className="text-[11px] font-semibold tracking-widest text-black/50">HEALTH TIPS</div>
                <div className="mt-6 text-sm text-black/50">
                  Placeholder tips — will be generated and cached like the briefing.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}




