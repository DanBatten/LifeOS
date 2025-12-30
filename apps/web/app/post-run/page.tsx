'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface SyncedWorkout {
  id: string;
  title: string;
  scheduledDate: string;
  actualDistanceMiles: number | null;
  actualDurationMinutes: number | null;
  actualPacePerMile: string | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFt: number | null;
  prescribedDistanceMiles: number | null;
  prescribedPacePerMile: string | null;
}

interface CoachAnalysis {
  summary: string;
  highlights: string[];
  areasToNote: string[];
  nextSteps: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type Step = 'ready' | 'syncing' | 'feedback' | 'analyzing' | 'conversation';

export default function PostRunPage() {
  const [step, setStep] = useState<Step>('ready');
  const [workout, setWorkout] = useState<SyncedWorkout | null>(null);
  const [coachAnalysis, setCoachAnalysis] = useState<CoachAnalysis | null>(null);
  const [conversationStarter, setConversationStarter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Feedback form
  const [feedback, setFeedback] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);
  
  // Conversation
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSync = async (includeFeedback = false) => {
    setStep(includeFeedback ? 'analyzing' : 'syncing');
    setError(null);

    try {
      const response = await fetch('/api/workout/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteFeedback: includeFeedback ? feedback : undefined,
          perceivedExertion: includeFeedback ? rpe : undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.workout) {
        setWorkout(data.workout);
        setCoachAnalysis(data.coachAnalysis);
        setConversationStarter(data.conversationStarter);
        
        // Add coach's initial message
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.conversationStarter,
          timestamp: new Date(),
        }]);
        
        setStep('conversation');
      } else if (data.syncAction === 'no_activity') {
        setError("No recent run found. Make sure your watch has synced with Garmin Connect.");
        setStep('ready');
      } else {
        setError(data.error || 'Failed to sync workout');
        setStep('ready');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
      setStep('ready');
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.sessionId) setSessionId(data.sessionId);

        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
        }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '--';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700/50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-slate-400 hover:text-white transition-colors"
            >
              &larr; Back
            </Link>
            <h1 className="text-xl font-semibold text-white">
              Post-Run Analysis
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {/* Step: Ready to Sync */}
        {step === 'ready' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Just finished your run?
            </h2>
            <p className="text-slate-400 mb-8 max-w-md">
              Let's sync your data from Garmin and get your coach's analysis.
            </p>
            
            {error && (
              <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={() => setStep('feedback')}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-semibold text-lg hover:from-emerald-600 hover:to-teal-700 transition-all transform hover:scale-105 shadow-lg shadow-emerald-500/25"
            >
              Sync My Run
            </button>
            
            <button
              onClick={() => startSync(false)}
              className="mt-4 text-slate-400 hover:text-white text-sm transition-colors"
            >
              Skip feedback, just sync →
            </button>
          </div>
        )}

        {/* Step: Feedback Form */}
        {step === 'feedback' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-4 text-center">
                Quick Check-in
              </h2>
              <p className="text-slate-400 text-sm mb-6 text-center">
                This helps your coach provide better analysis
              </p>

              {/* RPE Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  How hard did it feel? (1-10)
                </label>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                    <button
                      key={num}
                      onClick={() => setRpe(num)}
                      className={`w-9 h-9 rounded-lg font-medium text-sm transition-all ${
                        rpe === num
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 px-1">
                  <span>Easy</span>
                  <span>Max effort</span>
                </div>
              </div>

              {/* Feedback Text */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Any notes? (optional)
                </label>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="e.g., Felt strong in the middle miles, legs got heavy at the end..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('ready')}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => startSync(true)}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all"
                >
                  Analyze Run
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Syncing/Analyzing */}
        {(step === 'syncing' || step === 'analyzing') && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
              <div className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              {step === 'syncing' ? 'Syncing from Garmin...' : 'Analyzing your run...'}
            </h2>
            <p className="text-slate-400">
              {step === 'syncing' 
                ? 'Fetching your latest activity' 
                : 'Your coach is reviewing the data'}
            </p>
          </div>
        )}

        {/* Step: Conversation */}
        {step === 'conversation' && (
          <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Workout Summary Card */}
            {workout && (
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 mb-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">{workout.title}</h3>
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                    Synced ✓
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {workout.actualDistanceMiles?.toFixed(1) || '--'}
                    </div>
                    <div className="text-xs text-slate-400">miles</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {formatDuration(workout.actualDurationMinutes)}
                    </div>
                    <div className="text-xs text-slate-400">duration</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {workout.actualPacePerMile?.replace('/mi', '') || '--'}
                    </div>
                    <div className="text-xs text-slate-400">pace</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {workout.avgHeartRate || '--'}
                    </div>
                    <div className="text-xs text-slate-400">avg HR</div>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800/80 text-white border border-slate-700/50'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="text-xs text-emerald-400 font-medium mb-1">
                        Training Coach
                      </div>
                    )}
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/80 rounded-2xl px-4 py-3 border border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your run..."
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}







