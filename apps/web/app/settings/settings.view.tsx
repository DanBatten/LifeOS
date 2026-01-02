'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SettingsViewProps {
  userId: string;
  currentTimezone: string;
  userName: string;
  userEmail: string;
  preferences: Record<string, unknown>;
  commonTimezones: Array<{ value: string; label: string }>;
}

export function SettingsView({
  userId,
  currentTimezone,
  userName,
  userEmail,
  preferences,
  commonTimezones,
}: SettingsViewProps) {
  const [timezone, setTimezone] = useState(currentTimezone);
  const [detectedTimezone, setDetectedTimezone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect browser timezone on mount
  useEffect(() => {
    try {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setDetectedTimezone(browserTz);
    } catch {
      // Browser doesn't support timezone detection
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleUseDetected = () => {
    if (detectedTimezone) {
      setTimezone(detectedTimezone);
    }
  };

  // Get current time in selected timezone
  const getCurrentTimeInTz = (tz: string) => {
    try {
      return new Date().toLocaleString('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Invalid timezone';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8e0d8] via-[#d8cfc5] to-[#c8bfb5]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#e8e0d8]/95 backdrop-blur-sm border-b border-black/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/run-companion"
              className="text-[#4b2a24]/60 hover:text-[#4b2a24] transition-colors"
            >
              ← Back
            </Link>
            <h1 className="text-xl font-light tracking-wide text-[#4b2a24]">Settings</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* User Info */}
        <section className="bg-white/60 rounded-xl p-6 border border-black/10">
          <h2 className="text-lg font-medium text-[#4b2a24] mb-4">Profile</h2>
          <div className="space-y-3 text-[#4b2a24]/80">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium w-24">Name</span>
              <span>{userName}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium w-24">Email</span>
              <span>{userEmail}</span>
            </div>
          </div>
        </section>

        {/* Timezone Settings */}
        <section className="bg-white/60 rounded-xl p-6 border border-black/10">
          <h2 className="text-lg font-medium text-[#4b2a24] mb-2">Timezone</h2>
          <p className="text-sm text-[#4b2a24]/60 mb-4">
            Set your current timezone. This affects how dates are displayed and when "yesterday" means in chat.
          </p>

          {/* Detected timezone suggestion */}
          {detectedTimezone && detectedTimezone !== timezone && (
            <div className="mb-4 p-3 bg-[#ff5a2f]/10 rounded-lg border border-[#ff5a2f]/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-[#4b2a24]">
                    Your browser detected: <strong>{detectedTimezone}</strong>
                  </span>
                  <div className="text-xs text-[#4b2a24]/60 mt-1">
                    {getCurrentTimeInTz(detectedTimezone)}
                  </div>
                </div>
                <button
                  onClick={handleUseDetected}
                  className="px-3 py-1.5 text-sm bg-[#ff5a2f] text-white rounded-lg hover:bg-[#e54a20] transition-colors"
                >
                  Use This
                </button>
              </div>
            </div>
          )}

          {/* Current selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#4b2a24] mb-2">
                Current Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-black/15 rounded-lg text-[#4b2a24] focus:outline-none focus:ring-2 focus:ring-[#ff5a2f]/30"
              >
                {commonTimezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
                {/* Add detected timezone if not in list */}
                {detectedTimezone && !commonTimezones.some(tz => tz.value === detectedTimezone) && (
                  <option value={detectedTimezone}>
                    {detectedTimezone} (Detected)
                  </option>
                )}
                {/* Add current timezone if not in list */}
                {!commonTimezones.some(tz => tz.value === currentTimezone) && currentTimezone !== detectedTimezone && (
                  <option value={currentTimezone}>
                    {currentTimezone} (Current)
                  </option>
                )}
              </select>
            </div>

            {/* Preview */}
            <div className="p-4 bg-[#4b2a24]/5 rounded-lg">
              <div className="text-sm text-[#4b2a24]/60 mb-1">Current time in selected timezone:</div>
              <div className="text-lg font-medium text-[#4b2a24]">
                {getCurrentTimeInTz(timezone)}
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving || timezone === currentTimezone}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
                  saving || timezone === currentTimezone
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#ff5a2f] text-white hover:bg-[#e54a20] shadow-sm'
                }`}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              {saved && (
                <span className="text-green-600 text-sm font-medium animate-fade-in">
                  ✓ Saved successfully
                </span>
              )}

              {error && (
                <span className="text-red-600 text-sm font-medium">
                  {error}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Future: Other Settings */}
        <section className="bg-white/40 rounded-xl p-6 border border-black/5">
          <h2 className="text-lg font-medium text-[#4b2a24]/50 mb-2">Coming Soon</h2>
          <ul className="text-sm text-[#4b2a24]/40 space-y-2">
            <li>• Units preference (miles/km)</li>
            <li>• Notification settings</li>
            <li>• Theme customization</li>
            <li>• Garmin connection status</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

