'use client';

/**
 * app/admin/sessions/[id]/page.tsx
 *
 * Full session detail: intake summary, transcript, and video playback.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDateTime, sessionDuration, snakeToTitle } from '@/lib/utils';
import type { Session, TranscriptEntry } from '@/lib/database.types';

const INTAKE_FIELDS = [
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    declined: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    created: 'bg-slate-100 text-slate-600',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function VideoPlayer({ sessionId }: { sessionId: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noRecording, setNoRecording] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/sessions/${sessionId}/recording-url`)
      .then((res) => res.json())
      .then((data) => {
        if (data.url) {
          setVideoUrl(data.url);
        } else {
          setNoRecording(true);
        }
      })
      .catch(() => setNoRecording(true))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="aspect-video bg-slate-100 rounded-xl flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (noRecording || !videoUrl) {
    return (
      <div className="aspect-video bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 00-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409" />
        </svg>
        <p className="text-sm font-medium">No recording available</p>
        <p className="text-xs text-slate-300">Recording may not have been captured for this session</p>
      </div>
    );
  }

  return (
    <video
      src={videoUrl}
      controls
      className="w-full rounded-xl bg-black shadow-sm"
      style={{ maxHeight: '400px' }}
    >
      Your browser does not support the video element.
    </video>
  );
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/sessions/${sessionId}`)
      .then((res) => {
        if (res.status === 401) {
          router.push('/admin');
          return null;
        }
        if (!res.ok) throw new Error('Session not found');
        return res.json();
      })
      .then((data) => {
        if (data) setSession(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-600 font-medium">{error || 'Session not found'}</p>
          <button onClick={() => router.push('/admin')} className="text-teal-600 hover:underline text-sm">
            ← Back to sessions
          </button>
        </div>
      </div>
    );
  }

  const transcript = Array.isArray(session.transcript) ? session.transcript as TranscriptEntry[] : [];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to Sessions
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <div>
            <h1 className="font-semibold text-slate-800">{session.patient_name}</h1>
            <p className="text-xs text-slate-400">{formatDateTime(session.started_at)}</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <StatusBadge status={session.status} />
            <span className="text-xs text-slate-400">
              Duration: {sessionDuration(session.started_at, session.ended_at)}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-8 py-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Intake + Recording */}
          <div className="space-y-6">
            {/* Intake summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                  Intake Summary
                </h2>
              </div>
              <dl className="px-5 py-4 space-y-4">
                {/* Consent */}
                <div className="flex items-center justify-between">
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">Consent</dt>
                  <dd>
                    {session.consent === true && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        ✓ Granted
                      </span>
                    )}
                    {session.consent === false && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        ✗ Declined
                      </span>
                    )}
                    {session.consent === null && (
                      <span className="text-slate-300 text-sm">—</span>
                    )}
                  </dd>
                </div>

                {/* Intake fields */}
                {INTAKE_FIELDS.map((field) => {
                  const value = session[field];
                  return (
                    <div key={field}>
                      <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
                        {snakeToTitle(field)}
                      </dt>
                      <dd className="text-sm text-slate-700">
                        {value || <span className="text-slate-300 italic">Not captured</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            {/* Recording */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Session Recording
                </h2>
              </div>
              <div className="p-5">
                <VideoPlayer sessionId={sessionId} />
              </div>
            </div>
          </div>

          {/* Right: Transcript */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
                Transcript
                <span className="ml-auto text-xs font-normal text-slate-400">
                  {transcript.length} utterances
                </span>
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[600px]">
              {transcript.length === 0 ? (
                <p className="text-slate-300 text-sm italic text-center py-8">No transcript available</p>
              ) : (
                transcript.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 ${entry.role === 'replica' ? '' : 'flex-row-reverse'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                        entry.role === 'replica'
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {entry.role === 'replica' ? 'M' : 'P'}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        entry.role === 'replica'
                          ? 'bg-teal-50 text-teal-900 rounded-tl-sm'
                          : 'bg-slate-100 text-slate-800 rounded-tr-sm'
                      }`}
                    >
                      <p className="text-xs font-semibold mb-1 opacity-60">
                        {entry.role === 'replica' ? 'Maya (Receptionist)' : 'Patient'}
                      </p>
                      {entry.text}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
