'use client';

/**
 * components/meeting/CallView.tsx
 *
 * Main call screen orchestrator. Wires together:
 * - Daily call object (useCallState)
 * - Tavus app-message events (normalizeTavusAppMessage)
 * - Live transcript (useTranscript)
 * - Live intake panel (useIntakePanel)
 * - Canvas recording (useRecording)
 * - Incremental persistence (debounced PATCH)
 * - End-of-session flows
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCallState } from '@/hooks/useCallState';
import { useTranscript } from '@/hooks/useTranscript';
import { useIntakePanel } from '@/hooks/useIntakePanel';
import { useRecording } from '@/hooks/useRecording';
import { normalizeTavusAppMessage, TAVUS_TOOLS, INTAKE_FIELDS } from '@/lib/tavus-events';
import { debounce } from '@/lib/utils';
import type { IntakeField } from '@/lib/tavus-events';
import { IntakePanel } from './IntakePanel';
import { TranscriptStrip } from './TranscriptStrip';
import { CallControls } from './CallControls';

interface CallViewProps {
  sessionId: string;
  conversationUrl: string;
  patientName: string;
}

export function CallView({ sessionId, conversationUrl, patientName }: CallViewProps) {
  const router = useRouter();

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const { state: callState, join, leave, toggleMute, onAppMessage } = useCallState(conversationUrl);
  const transcript = useTranscript();
  const intake = useIntakePanel();
  const recording = useRecording(sessionId);

  // ── Video element refs ─────────────────────────────────────────────────────
  const replicaVideoRef = useRef<HTMLVideoElement>(null);
  const patientVideoRef = useRef<HTMLVideoElement>(null);

  // ── Session end state ──────────────────────────────────────────────────────
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endReason, setEndReason] = useState<'granted' | 'declined' | 'manual'>('manual');
  const [isEndingSession, setIsEndingSession] = useState(false);
  const endedRef = useRef(false); // prevent double-end

  // ── Debounced persistence ──────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const persistSession = useCallback(
    debounce(async (payload: Record<string, unknown>) => {
      try {
        await fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.warn('[CallView] Persist error:', e);
      }
    }, 1500),
    [sessionId]
  );

  // ── Attach video tracks to <video> elements ────────────────────────────────
  useEffect(() => {
    const { replicaTracks, localTracks } = callState;

    if (replicaVideoRef.current && (replicaTracks.videoTrack || replicaTracks.audioTrack)) {
      // Include BOTH tracks so the (unmuted) replica element plays Maya's voice.
      // Audio often arrives in a separate track-started event after video, so
      // this effect re-runs and re-attaches once the audio track is present.
      const tracks: MediaStreamTrack[] = [];
      if (replicaTracks.videoTrack) tracks.push(replicaTracks.videoTrack);
      if (replicaTracks.audioTrack) tracks.push(replicaTracks.audioTrack);
      replicaVideoRef.current.srcObject = new MediaStream(tracks);
      replicaVideoRef.current.play().catch(() => {});
    }

    if (patientVideoRef.current && localTracks.videoTrack) {
      const stream = new MediaStream([localTracks.videoTrack]);
      patientVideoRef.current.srcObject = stream;
      patientVideoRef.current.play().catch(() => {});
    }

    // Update recording sources when tracks change
    recording.updateSources(
      replicaVideoRef.current,
      patientVideoRef.current,
      replicaTracks.audioTrack,
      localTracks.audioTrack
    );
  }, [callState.replicaTracks, callState.localTracks, recording]);

  // ── Start recording when connected ────────────────────────────────────────
  useEffect(() => {
    if (callState.stage === 'connected' && recording.status === 'idle') {
      // Small delay to let video tracks stabilize
      const t = setTimeout(() => {
        recording.start(
          replicaVideoRef.current,
          patientVideoRef.current,
          callState.replicaTracks.audioTrack,
          callState.localTracks.audioTrack
        );
        // Mark session as in_progress
        fetch(`/api/sessions/${sessionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' }),
        }).catch(() => {});
      }, 1000);
      return () => clearTimeout(t);
    }
  }, [callState.stage, recording, sessionId, callState.replicaTracks.audioTrack, callState.localTracks.audioTrack]);

  // ── End session handler ────────────────────────────────────────────────────
  const endSession = useCallback(
    async (reason: 'granted' | 'declined' | 'manual' = 'manual') => {
      if (endedRef.current) return;
      endedRef.current = true;
      setIsEndingSession(true);
      setEndReason(reason);

      // 1. Stop recording + upload
      await recording.stopAndUpload();

      // 2. Leave Daily room
      await leave();

      // 3. Call end API
      const finalStatus = reason === 'declined' ? 'declined' : 'completed';
      await fetch(`/api/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: finalStatus }),
      }).catch(() => {});

      setSessionEnded(true);
      setIsEndingSession(false);
    },
    [recording, leave, sessionId]
  );

  // ── App-message event handler ──────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAppMessage((rawData) => {
      const event = normalizeTavusAppMessage(rawData);
      if (!event) {
        // Surface conversation events we failed to parse so schema drift is
        // visible instead of silently dropped.
        const d = rawData as { message_type?: string; event_type?: string } | null;
        if (d && (d.message_type === 'conversation' || d.event_type?.startsWith('conversation.'))) {
          console.warn('[CallView] Unhandled Tavus conversation event:', d.event_type, rawData);
        }
        return;
      }

      if (event.type === 'utterance') {
        const entry = { role: event.role, text: event.text, ts: event.ts };
        transcript.addEntry(entry);
        // Persist using the ref (kept current by addEntry) — avoids a stale
        // closure over transcript.entries.
        persistSession({ transcript: [...transcript.entriesRef.current, entry] });
      }

      if (event.type === 'tool_call') {
        const { tool, args } = event;

        if (tool === TAVUS_TOOLS.RECORD_CONSENT) {
          const granted = args.status === 'granted';
          intake.updateConsent(granted);
          persistSession({ consent: granted, status: granted ? 'in_progress' : 'declined' });

          if (!granted) {
            // Consent denied — end session after a short delay (let AI finish speaking)
            setTimeout(() => endSession('declined'), 3000);
          }
        }

        if (tool === TAVUS_TOOLS.RECORD_PATIENT_INFO) {
          const field = args.field as IntakeField;
          const value = String(args.value ?? '');
          if (INTAKE_FIELDS.includes(field)) {
            intake.updateField(field, value);

            // Persist individual column + intake object
            persistSession({
              [field]: value,
              intake: { ...intake.toIntakeObject(), [field]: value },
            });
          }
        }

        if (tool === TAVUS_TOOLS.END_SESSION) {
          // Map the spec's end reason onto our local end state.
          const reason = args.reason === 'consent_declined' ? 'declined' : 'granted';
          setTimeout(() => endSession(reason), 1500);
        }
      }
    });

    return unsubscribe;
  }, [onAppMessage, transcript, intake, persistSession, endSession]);

  // ── Handle replica leaving (Tavus ends conversation) ──────────────────────
  useEffect(() => {
    if (callState.stage === 'left' && !endedRef.current) {
      endSession('granted');
    }
  }, [callState.stage, endSession]);

  // ── Join on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    join();
  }, [join]);

  // ── visibilitychange guard — attempt upload if tab is hidden ──────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && recording.status === 'recording') {
        // Best-effort: stop and upload via beacon
        recording.stopAndUpload().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [recording]);

  // ── Render: Session ended screen ───────────────────────────────────────────
  if (sessionEnded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          {endReason === 'declined' ? (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">No problem, {patientName}</h1>
                <p className="text-slate-300 leading-relaxed">
                  Please contact the dental team directly to arrange your visit. You can call us or speak with the front desk.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">Thank you, {patientName}!</h1>
                <p className="text-slate-300 leading-relaxed">
                  The dental team will review your information before your visit. See you soon!
                </p>
              </div>
            </>
          )}

          {(recording.status === 'uploading' || recording.status === 'stopping') && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving session recording…
            </div>
          )}

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

  // ── Render: Ending in progress ─────────────────────────────────────────────
  if (isEndingSession) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <svg className="w-10 h-10 animate-spin text-teal-400 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-slate-300 text-lg font-medium">Uploading session…</p>
          <p className="text-slate-500 text-sm">Please keep this tab open</p>
        </div>
      </div>
    );
  }

  // ── Render: Main call UI ───────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-teal-600 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-white font-semibold text-sm">DentaGreet</span>
        </div>

        {/* REC indicator */}
        {recording.status === 'recording' && (
          <div className="flex items-center gap-1.5 bg-red-900/50 border border-red-700/50 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 rec-dot" />
            <span className="text-red-300 text-xs font-semibold tracking-wide">REC</span>
          </div>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              callState.stage === 'connected' ? 'bg-green-400' :
              callState.stage === 'joining' ? 'bg-amber-400 animate-pulse' :
              'bg-slate-500'
            }`}
          />
          <span className="text-slate-400 text-xs capitalize">{callState.stage}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left 75%: Video area */}
        <div className="flex-1 flex flex-col relative" style={{ width: '75%' }}>
          {/* Replica video */}
          <div className="flex-1 relative bg-slate-800 overflow-hidden">
            {callState.stage === 'joining' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                <svg className="w-10 h-10 animate-spin text-teal-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-slate-300 text-sm">Connecting to Maya…</p>
              </div>
            )}

            {callState.stage === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-red-300 font-medium">Connection error</p>
                <p className="text-slate-400 text-sm">{callState.error}</p>
              </div>
            )}

            {/* Replica video element */}
            <video
              ref={replicaVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Patient PiP — bottom-right of video area */}
            <div className="absolute bottom-4 right-4 w-40 h-24 rounded-xl overflow-hidden border-2 border-white/20 shadow-xl bg-slate-700">
              <video
                ref={patientVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover scale-x-[-1]"
              />
              {!callState.localTracks.videoTrack && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Transcript strip */}
          <div className="bg-slate-900/95 border-t border-slate-700 min-h-[72px] max-h-[100px] overflow-hidden">
            <TranscriptStrip entries={transcript.entries} />
          </div>

          {/* Controls */}
          <CallControls
            isMuted={callState.isMuted}
            onToggleMute={toggleMute}
            onEndSession={() => endSession('manual')}
            disabled={callState.stage !== 'connected' || isEndingSession}
          />
        </div>

        {/* Right 25%: Intake panel */}
        <div className="flex-shrink-0" style={{ width: '25%', minWidth: '280px' }}>
          <IntakePanel
            patientName={patientName}
            consent={intake.consent}
            fields={intake.fields}
          />
        </div>
      </div>
    </div>
  );
}
