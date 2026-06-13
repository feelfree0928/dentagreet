'use client';

/**
 * app/admin/sessions/[id]/page.tsx
 *
 * Full session detail: intake summary, transcript, and video playback.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDateTime, sessionDuration, snakeToTitle } from '@/lib/utils';
import type { Session, TranscriptEntry, SoapNote, ConsentLanguage } from '@/lib/database.types';

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
    completed: 'badge-success',
    declined: 'badge-warn',
    in_progress: 'badge-info',
    created: 'badge-muted',
    error: 'badge-danger',
  };
  return (
    <span className={`badge ${styles[status] ?? 'badge-muted'} capitalize`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function VideoPlayer({ sessionId }: { sessionId: string }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [noRecording, setNoRecording] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/admin/sessions/${sessionId}/recording-url`);
        const data = (await res.json()) as { urls?: string[] };
        const urls = data.urls ?? [];

        if (urls.length === 0) {
          if (!cancelled) setNoRecording(true);
          return;
        }

        // Segments are pieces of one continuous WebM stream — only the first
        // carries the header. Download them all in order and concatenate into
        // a single playable blob.
        const blobs: Blob[] = [];
        for (const url of urls) {
          const segRes = await fetch(url);
          blobs.push(await segRes.blob());
        }
        if (cancelled) return;

        objectUrl = URL.createObjectURL(new Blob(blobs, { type: 'video/webm' }));
        setVideoUrl(objectUrl);
      } catch {
        if (!cancelled) setNoRecording(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sessionId]);

  if (loading) {
    return (
      <div className="aspect-video skeleton rounded-2xl flex items-center justify-center">
        <span className="text-xs font-medium text-slate-400">Loading recording…</span>
      </div>
    );
  }

  if (noRecording || !videoUrl) {
    return (
      <div className="aspect-video rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2.5 text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 00-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">No recording available</p>
        <p className="text-xs text-slate-300">Recording may not have been captured for this session</p>
      </div>
    );
  }

  return (
    <video
      src={videoUrl}
      controls
      className="w-full rounded-2xl bg-black shadow-md ring-1 ring-slate-900/5"
      style={{ maxHeight: '420px' }}
    >
      Your browser does not support the video element.
    </video>
  );
}

function ConsentLanguageCard({ data }: { data: ConsentLanguage }) {
  const matched = data.matched;
  return (
    <div
      className={`app-card overflow-hidden ${matched ? 'ring-1 ring-emerald-200/70' : 'ring-1 ring-rose-200/70'}`}
    >
      {/* Verdict hero */}
      <div className={`flex items-center gap-4 px-5 sm:px-6 py-5 ${matched ? 'bg-gradient-to-r from-emerald-50 to-teal-50/40' : 'bg-gradient-to-r from-rose-50 to-amber-50/40'}`}>
        <div className={`flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md ${matched ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-rose-500 to-rose-400'}`}>
          {matched ? '✓' : '✗'}
        </div>
        <div className="min-w-0">
          <p className="section-title">Consent Language Verification</p>
          <h2 className={`font-bold text-base sm:text-lg leading-tight ${matched ? 'text-emerald-800' : 'text-rose-800'}`}>
            {matched ? 'Consent delivered in the patient’s language' : 'Language mismatch detected'}
          </h2>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 p-3.5">
            <dt className="section-title mb-1">Patient first spoke</dt>
            <dd className="text-sm font-bold text-slate-800">{data.patient_language || '—'}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5">
            <dt className="section-title mb-1">Consent delivered in</dt>
            <dd className="text-sm font-bold text-slate-800">{data.consent_delivered_language || '—'}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5">
            <dt className="section-title mb-1">Consent outcome</dt>
            <dd className="text-sm font-bold text-slate-800 capitalize">{data.consent_outcome}</dd>
          </div>
        </div>

        <div>
          <dt className="section-title mb-1.5">Assessment</dt>
          <dd className="text-sm text-slate-700 leading-relaxed">{data.explanation}</dd>
        </div>

        {data.evidence?.length > 0 && (
          <div>
            <dt className="section-title mb-2">Evidence</dt>
            <div className="space-y-2">
              {data.evidence.map((e, i) => (
                <div key={i} className="flex gap-2.5 text-sm rounded-xl bg-slate-50 px-3 py-2.5">
                  <span
                    className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold h-fit ${
                      e.role === 'replica' ? 'bg-teal-100 text-teal-700' : 'bg-sky-100 text-sky-700'
                    }`}
                  >
                    {e.role === 'replica' ? 'Maya' : 'Patient'}
                  </span>
                  <span className="text-slate-600 italic">&ldquo;{e.quote}&rdquo;</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SoapNoteCard({ data }: { data: SoapNote }) {
  const sections: Array<{ key: string; label: string; text: string; note?: string; icon: string; tint: string }> = [
    { key: 'S', label: 'Subjective', text: data.subjective, icon: 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z', tint: 'bg-teal-50 text-teal-600' },
    { key: 'O', label: 'Objective', text: data.objective, icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z', tint: 'bg-sky-50 text-sky-600' },
    { key: 'A', label: 'Assessment', text: data.assessment, note: 'Non-diagnostic reception summary', icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z', tint: 'bg-amber-50 text-amber-600' },
    { key: 'P', label: 'Plan', text: data.plan, icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', tint: 'bg-violet-50 text-violet-600' },
  ];
  return (
    <div className="app-card overflow-hidden">
      <div className="app-card-header">
        <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h2 className="font-bold text-slate-700 text-sm">Clinical SOAP Note</h2>
      </div>
      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((s) => (
          <div key={s.key} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${s.tint}`}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                </svg>
              </span>
              <dt className="text-sm font-bold text-slate-700">{s.label}</dt>
              {s.note && <span className="text-[11px] text-slate-400">· {s.note}</span>}
            </div>
            <dd className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{s.text}</dd>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SoapResponse {
  soap_note: SoapNote | null;
  consent_language: ConsentLanguage | null;
  reason?: string;
  error?: string;
}

function ClinicalAnalysis({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<SoapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const load = (method: 'GET' | 'POST') => {
    if (method === 'POST') setRegenerating(true);
    else setLoading(true);
    setError('');
    fetch(`/api/admin/sessions/${sessionId}/soap`, { method })
      .then(async (res) => {
        const body = (await res.json()) as SoapResponse;
        if (!res.ok) throw new Error(body.error || 'Analysis failed');
        return body;
      })
      .then((body) => setData(body))
      .catch((err) => setError(err.message))
      .finally(() => {
        setLoading(false);
        setRegenerating(false);
      });
  };

  useEffect(() => {
    load('GET');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return (
      <div className="app-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <svg className="w-5 h-5 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-slate-500">Generating SOAP note &amp; consent-language analysis…</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
        <div className="skeleton h-24 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-card ring-1 ring-rose-200/70 px-5 py-6 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-rose-600 font-medium">{error}</p>
        <button onClick={() => load('GET')} className="btn btn-primary px-4 py-2 text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (data?.reason === 'not_configured') {
    return (
      <div className="app-card ring-1 ring-amber-200/70 px-5 py-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-700">AI analysis isn&rsquo;t configured</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
          Set <code className="font-mono text-[11px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> in your <code className="font-mono text-[11px] bg-amber-50 text-amber-700 px-1 py-0.5 rounded">.env</code> and restart the server to generate the SOAP note &amp; consent-language verification.
        </p>
      </div>
    );
  }

  if (!data || data.reason === 'no_transcript' || (!data.soap_note && !data.consent_language)) {
    return (
      <div className="app-card px-5 py-10 text-center text-slate-400">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-500">No analysis available</p>
        <p className="text-xs text-slate-300 mt-1">There isn&rsquo;t enough conversation in this session to generate a SOAP note.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {data.consent_language && <ConsentLanguageCard data={data.consent_language} />}
      {data.soap_note && <SoapNoteCard data={data.soap_note} />}
      <div className="flex items-center justify-end gap-3">
        {data.soap_note && (
          <span className="text-xs text-slate-400">
            Generated by {data.soap_note.model} · {formatDateTime(data.soap_note.generated_at)}
          </span>
        )}
        <button
          onClick={() => load('POST')}
          disabled={regenerating}
          className="chip hover:bg-slate-200 disabled:opacity-50 transition-colors"
        >
          {regenerating ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>
    </div>
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center">
            <svg className="w-6 h-6 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400">Loading session…</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="app-card p-8 text-center space-y-3 max-w-sm w-full">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className="text-slate-700 font-semibold">{error || 'Session not found'}</p>
          <button onClick={() => router.push('/admin')} className="btn btn-primary w-full">
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
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-slate-200/80 px-5 sm:px-8 py-3.5">
        <div className="flex items-center gap-3 sm:gap-4 max-w-7xl mx-auto">
          <button
            onClick={() => router.push('/admin')}
            className="btn btn-ghost px-2.5 py-2 text-sm flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="h-6 w-px bg-slate-200 flex-shrink-0" />
          <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-400 text-white text-sm font-bold flex items-center justify-center shadow-sm">
            {initials(session.patient_name)}
          </span>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-800 leading-tight truncate">{session.patient_name}</h1>
            <p className="text-xs text-slate-400 truncate">{formatDateTime(session.started_at)}</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={session.status} />
            <span className="chip hidden sm:inline-flex font-mono">
              {sessionDuration(session.started_at, session.ended_at)}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-8 py-6 max-w-7xl mx-auto space-y-6">
        {/* Clinical SOAP note + consent-language verification */}
        <ClinicalAnalysis sessionId={sessionId} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Intake + Recording */}
          <div className="space-y-6">
            {/* Intake summary */}
            <div className="app-card overflow-hidden">
              <div className="app-card-header">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                </div>
                <h2 className="font-bold text-slate-700 text-sm">Intake Summary</h2>
              </div>
              <dl className="px-5 py-4 space-y-3.5">
                {/* Consent */}
                <div className="flex items-center justify-between">
                  <dt className="section-title">Consent</dt>
                  <dd>
                    {session.consent === true && <span className="badge badge-success">✓ Granted</span>}
                    {session.consent === false && <span className="badge badge-danger">✗ Declined</span>}
                    {session.consent === null && <span className="text-slate-300 text-sm">—</span>}
                  </dd>
                </div>

                <div className="border-t border-slate-100" />

                {/* Intake fields */}
                {INTAKE_FIELDS.map((field) => {
                  const value = session[field];
                  return (
                    <div key={field}>
                      <dt className="section-title mb-1">{snakeToTitle(field)}</dt>
                      <dd className="text-sm text-slate-700">
                        {value || <span className="text-slate-300 italic">Not captured</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>

            {/* Recording */}
            <div className="app-card overflow-hidden">
              <div className="app-card-header">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <h2 className="font-bold text-slate-700 text-sm">Session Recording</h2>
              </div>
              <div className="p-5">
                <VideoPlayer sessionId={sessionId} />
              </div>
            </div>
          </div>

          {/* Right: Transcript */}
          <div className="app-card overflow-hidden flex flex-col">
            <div className="app-card-header flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <h2 className="font-bold text-slate-700 text-sm">Transcript</h2>
              <span className="ml-auto chip">{transcript.length} utterances</span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 max-h-[640px]">
              {transcript.length === 0 ? (
                <p className="text-slate-300 text-sm italic text-center py-8">No transcript available</p>
              ) : (
                transcript.map((entry, i) => (
                  <div
                    key={i}
                    className={`flex gap-2.5 ${entry.role === 'replica' ? '' : 'flex-row-reverse'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold shadow-sm ${
                        entry.role === 'replica'
                          ? 'bg-gradient-to-br from-teal-500 to-teal-400 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {entry.role === 'replica' ? 'M' : 'P'}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        entry.role === 'replica'
                          ? 'bg-teal-50 text-teal-900 rounded-tl-sm ring-1 ring-teal-100'
                          : 'bg-slate-100 text-slate-800 rounded-tr-sm'
                      }`}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5 opacity-50">
                        {entry.role === 'replica' ? 'Maya' : 'Patient'}
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
