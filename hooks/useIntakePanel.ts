'use client';

/**
 * hooks/useIntakePanel.ts
 *
 * Manages live intake field state with highlight animation tracking.
 * Each field gets a "lastUpdated" timestamp used to trigger CSS highlight.
 */

import { useState, useCallback, useRef } from 'react';
import type { IntakeField } from '@/lib/tavus-events';

export interface IntakeFieldState {
  value: string;
  lastUpdated: number; // Date.now() — used to trigger re-animation
}

export type IntakePanelState = Partial<Record<IntakeField, IntakeFieldState>>;

export function useIntakePanel() {
  const [fields, setFields] = useState<IntakePanelState>({});
  const [consent, setConsent] = useState<boolean | null>(null);
  // Mirrors `fields` synchronously so toIntakeObject() reflects the latest
  // values even when several tool calls arrive between renders.
  const fieldsRef = useRef<IntakePanelState>({});

  const updateField = useCallback((field: IntakeField, value: string) => {
    setFields((prev) => {
      const next = { ...prev, [field]: { value, lastUpdated: Date.now() } };
      fieldsRef.current = next;
      return next;
    });
  }, []);

  const updateConsent = useCallback((granted: boolean) => {
    setConsent(granted);
  }, []);

  const reset = useCallback(() => {
    fieldsRef.current = {};
    setFields({});
    setConsent(null);
  }, []);

  // Serialize to plain object for API persistence (reads the ref so it's fresh).
  const toIntakeObject = useCallback((): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(fieldsRef.current)) {
      if (val) result[key] = val.value;
    }
    return result;
  }, []);

  return { fields, consent, updateField, updateConsent, reset, toIntakeObject };
}
