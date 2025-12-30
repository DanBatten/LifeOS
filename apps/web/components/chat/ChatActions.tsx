'use client';

import type React from 'react';

export type ChatAction = {
  label: string;
  command: string;
  variant?: 'primary' | 'secondary' | 'danger';
};

export function ChatActions({
  actions,
  onSelect,
  disabled,
  tone = 'default',
}: {
  actions?: ChatAction[];
  onSelect: (action: ChatAction) => void;
  disabled?: boolean;
  tone?: 'default' | 'companion';
}) {
  if (!actions || actions.length === 0) return null;

  const base =
    tone === 'companion'
      ? 'rounded-md px-3 py-2 text-sm font-normal shadow-sm disabled:opacity-60 disabled:cursor-not-allowed'
      : 'rounded-full px-4 py-2 text-sm border transition-all disabled:opacity-40 disabled:cursor-not-allowed';

  const stylesByVariant: Record<NonNullable<ChatAction['variant']>, string> =
    tone === 'companion'
      ? {
          primary: 'bg-[#ff5a2f] text-white',
          secondary: 'bg-white/70 text-[#3a2f2a] border border-black/10',
          danger: 'bg-red-500/90 text-white',
        }
      : {
          primary:
            'bg-[#1a1a1a] text-white border border-[#1a1a1a] hover:opacity-90 dark:bg-white dark:text-black dark:border-white',
          secondary:
            'bg-white text-gray-700 border border-gray-200 hover:border-[#D4E157] dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700',
          danger:
            'bg-red-600 text-white border border-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
        };

  return (
    <div className={tone === 'companion' ? 'mt-3 flex flex-wrap gap-2' : 'mt-3 flex flex-wrap gap-2'}>
      {actions.map((a) => {
        const variant = a.variant || 'secondary';
        return (
          <button
            key={`${a.label}:${a.command}`}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(a)}
            className={`${base} ${stylesByVariant[variant]}`}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}





