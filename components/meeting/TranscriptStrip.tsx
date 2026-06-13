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
      <div className="px-5 py-4 flex items-center gap-2.5">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-slate-400 text-sm italic">Waiting for Maya to speak…</span>
      </div>
    );
  }

  return (
    <div className="px-5 py-3 space-y-1.5 overflow-hidden transcript-scroll">
      {last3.map((entry, i) => (
        <div
          key={`${entry.ts}-${i}`}
          className={cn(
            'flex items-start gap-2.5 text-sm leading-snug transition-opacity duration-300',
            i < last3.length - 1 ? 'opacity-40' : 'opacity-100'
          )}
        >
          <span
            className={cn(
              'flex-shrink-0 text-[11px] font-bold uppercase tracking-wide mt-0.5 min-w-[92px]',
              entry.role === 'replica' ? 'text-teal-300' : 'text-sky-300'
            )}
          >
            {entry.role === 'replica' ? 'Maya' : 'You'}
          </span>
          <span className="text-slate-100 line-clamp-2">{entry.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
