'use client';

/**
 * components/meeting/TranscriptStrip.tsx
 *
 * Rolling transcript strip showing last 3 utterances.
 * Auto-scrolls to the latest entry.
 */

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TranscriptEntry } from '@/lib/database.types';

interface TranscriptStripProps {
  entries: TranscriptEntry[];
}

export function TranscriptStrip({ entries }: TranscriptStripProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const last3 = entries.slice(-3);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-slate-400 text-sm italic">Waiting for Mia to speak…</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-1.5 overflow-hidden transcript-scroll">
      {last3.map((entry, i) => (
        <div
          key={`${entry.ts}-${i}`}
          className={cn(
            'flex items-start gap-2 text-sm leading-snug',
            i < last3.length - 1 && 'opacity-50'
          )}
        >
          <span
            className={cn(
              'flex-shrink-0 text-xs font-semibold mt-0.5 min-w-[90px]',
              entry.role === 'replica' ? 'text-teal-400' : 'text-slate-300'
            )}
          >
            {entry.role === 'replica' ? 'Receptionist:' : 'You:'}
          </span>
          <span className="text-slate-100 line-clamp-2">{entry.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
