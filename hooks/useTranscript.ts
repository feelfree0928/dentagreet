'use client';

/**
 * hooks/useTranscript.ts
 *
 * Manages the live transcript buffer.
 * Appends utterances from Tavus app-messages.
 */

import { useState, useCallback, useRef } from 'react';
import type { TranscriptEntry } from '@/lib/database.types';

export function useTranscript() {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  // Mirrors `entries` synchronously so debounced persistence reads the latest
  // list instead of a stale closure value.
  const entriesRef = useRef<TranscriptEntry[]>([]);

  const addEntry = useCallback((entry: TranscriptEntry) => {
    setEntries((prev) => {
      // Deduplicate: skip if last entry has same role + text
      const last = prev[prev.length - 1];
      if (last && last.role === entry.role && last.text === entry.text) {
        return prev;
      }
      const next = [...prev, entry];
      entriesRef.current = next;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    entriesRef.current = [];
    setEntries([]);
  }, []);

  // Last N entries for the rolling transcript strip
  const lastEntries = (n: number) => entries.slice(-n);

  return { entries, entriesRef, addEntry, reset, lastEntries };
}
