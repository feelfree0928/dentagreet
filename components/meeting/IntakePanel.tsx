'use client';

/**
 * components/meeting/IntakePanel.tsx
 *
 * Right 25% panel showing live intake data.
 * Fields highlight with a teal animation when updated.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { IntakePanelState } from '@/hooks/useIntakePanel';

interface IntakePanelProps {
  patientName: string;
  consent: boolean | null;
  fields: IntakePanelState;
}

const FIELD_LABELS: Record<string, string> = {
  reason_for_visit: 'Reason for Visit',
  symptom_description: 'Symptoms',
  symptom_location: 'Location',
  pain_level: 'Pain Level',
  symptom_duration: 'Duration',
  symptom_triggers: 'Triggers',
  relevant_history: 'Relevant History',
  medications_allergies: 'Medications & Allergies',
  additional_notes: 'Additional Notes',
  urgent_flag: 'Urgent Flag',
};

const FIELD_ORDER = [
  'reason_for_visit',
  'symptom_description',
  'symptom_location',
  'pain_level',
  'symptom_duration',
  'symptom_triggers',
  'relevant_history',
  'medications_allergies',
  'additional_notes',
  'urgent_flag',
] as const;

function IntakeField({
  label,
  value,
  lastUpdated,
}: {
  label: string;
  value: string | undefined;
  lastUpdated: number | undefined;
}) {
  const [highlighted, setHighlighted] = useState(false);
  const prevUpdated = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (lastUpdated && lastUpdated !== prevUpdated.current) {
      prevUpdated.current = lastUpdated;
      setHighlighted(true);
      const t = setTimeout(() => setHighlighted(false), 2000);
      return () => clearTimeout(t);
    }
  }, [lastUpdated]);

  return (
    <div className="space-y-1">
      <dt className="section-title">{label}</dt>
      <dd
        className={cn(
          'text-sm text-slate-800 min-h-[1.75rem] px-2.5 py-1.5 rounded-lg transition-colors duration-150',
          highlighted && 'bg-teal-100 text-teal-900 ring-1 ring-teal-200',
          !value && 'text-slate-300 italic'
        )}
      >
        {value || 'Waiting…'}
      </dd>
    </div>
  );
}

function ConsentBadge({ consent }: { consent: boolean | null }) {
  if (consent === null) {
    return (
      <span className="badge badge-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
        Pending
      </span>
    );
  }
  if (consent === true) {
    return (
      <span className="badge badge-success">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        ✓ Granted
      </span>
    );
  }
  return (
    <span className="badge badge-danger">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      ✗ Declined
    </span>
  );
}

export function IntakePanel({ patientName, consent, fields }: IntakePanelProps) {
  return (
    <aside className="h-full flex flex-col bg-white border-l border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
          </svg>
          Your Information
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-teal-700 bg-teal-50 ring-1 ring-teal-200/70 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            LIVE
          </span>
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Patient name */}
        <div className="space-y-1">
          <dt className="section-title">Patient</dt>
          <dd className="text-sm font-semibold text-slate-800">{patientName}</dd>
        </div>

        {/* Consent */}
        <div className="space-y-1.5">
          <dt className="section-title">Consent</dt>
          <dd>
            <ConsentBadge consent={consent} />
          </dd>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Intake fields */}
        <dl className="space-y-4">
          {FIELD_ORDER.map((key) => (
            <IntakeField
              key={key}
              label={FIELD_LABELS[key]}
              value={fields[key]?.value}
              lastUpdated={fields[key]?.lastUpdated}
            />
          ))}
        </dl>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/80">
        <p className="text-xs text-slate-400 text-center leading-relaxed">
          Please verify this information is accurate
        </p>
      </div>
    </aside>
  );
}
