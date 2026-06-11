'use client';

/**
 * app/meeting/[sessionId]/page.tsx
 *
 * The call screen. Fetches session data, shows hair-check, then CallView.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HairCheck } from '@/components/meeting/HairCheck';
import { CallView } from '@/components/meeting/CallView';
import type { Session } from '@/lib/database.types';

type PageStage = 'loading' | 'haircheck' | 'call' | 'error';

export default function MeetingPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [stage, setStage] = useState<PageStage>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch session data on mount
  useEffect(() => {
    if (!sessionId) return;

    fetch(`/api/sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Session not found');
        return res.json();
      })
      .then((data: Session) => {
        setSession(data);
        setStage('haircheck');
      })
      .catch((err) => {
        console.error('[MeetingPage] Session fetch error:', err);
        setErrorMsg('Session not found or expired. Please start a new session.');
        setStage('error');
      });
  }, [sessionId]);

  function handleHairCheckStart() {
    setStage('call');
  }

  function handleHairCheckError(msg: string) {
    setErrorMsg(msg);
    setStage('error');
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <svg className="w-10 h-10 animate-spin text-teal-400 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-400">Preparing your session…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (stage === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 text-sm leading-relaxed">{errorMsg}</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-8 py-3 rounded-xl transition-all"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  // ── Hair check ─────────────────────────────────────────────────────────────
  if (stage === 'haircheck' && session) {
    return (
      <HairCheck
        patientName={session.patient_name}
        onStart={handleHairCheckStart}
        onError={handleHairCheckError}
      />
    );
  }

  // ── Call ───────────────────────────────────────────────────────────────────
  if (stage === 'call' && session) {
    return (
      <CallView
        sessionId={sessionId}
        conversationUrl={session.tavus_conversation_url!}
        patientName={session.patient_name}
      />
    );
  }

  return null;
}
