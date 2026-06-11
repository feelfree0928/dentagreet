'use client';

/**
 * hooks/useCallState.ts
 *
 * Manages the Daily.co call object lifecycle.
 * Handles joining, participant tracks, and leaving.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { TAVUS_EVENTS } from '@/lib/tavus-events';

export type CallStage =
  | 'idle'
  | 'joining'
  | 'connected'
  | 'left'
  | 'error';

export interface ParticipantTracks {
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
}

export interface CallState {
  stage: CallStage;
  error: string | null;
  replicaTracks: ParticipantTracks;
  localTracks: ParticipantTracks;
  isMuted: boolean;
}

export function useCallState(conversationUrl: string | null) {
  const callRef = useRef<import('@daily-co/daily-js').DailyCall | null>(null);
  const [state, setState] = useState<CallState>({
    stage: 'idle',
    error: null,
    replicaTracks: { videoTrack: null, audioTrack: null },
    localTracks: { videoTrack: null, audioTrack: null },
    isMuted: false,
  });

  // Store app-message handler so consumers can subscribe
  const appMessageHandlers = useRef<Array<(data: unknown) => void>>([]);
  // Buffer messages that arrive before any handler is subscribed, so the
  // replica's opening greeting/consent events are never lost to a timing gap.
  const earlyMessages = useRef<unknown[]>([]);

  const onAppMessage = useCallback((handler: (data: unknown) => void) => {
    appMessageHandlers.current.push(handler);
    // Flush anything that arrived before the first subscriber.
    if (earlyMessages.current.length > 0) {
      const buffered = earlyMessages.current;
      earlyMessages.current = [];
      buffered.forEach((d) => handler(d));
    }
    return () => {
      appMessageHandlers.current = appMessageHandlers.current.filter((h) => h !== handler);
    };
  }, []);

  const join = useCallback(async () => {
    if (!conversationUrl) return;
    if (callRef.current) return; // already joined

    setState((s) => ({ ...s, stage: 'joining', error: null }));

    try {
      // Dynamic import — daily-js is browser-only
      const Daily = (await import('@daily-co/daily-js')).default;

      // Re-check after the await: a concurrent join() (or a Strict Mode
      // remount) may have created the instance while we were importing.
      if (callRef.current) return;

      // Daily allows only one call object per page. A previous mount's async
      // teardown may not have finished, leaving a stale global singleton —
      // destroy it before creating a new one, or createCallObject throws
      // "Duplicate DailyIframe instances are not allowed".
      const existing = Daily.getCallInstance();
      if (existing) {
        await existing.destroy();
      }

      const call = Daily.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      callRef.current = call;

      // ── Event listeners ────────────────────────────────────────────────────

      call.on('joined-meeting', () => {
        setState((s) => ({ ...s, stage: 'connected' }));
        // Explicitly publish the mic. Don't rely on join defaults — a device
        // handoff from the HairCheck preview can leave local audio unstarted,
        // which means Tavus never hears the patient and the replica never
        // responds. Forcing it on guarantees the upstream audio path.
        call.setLocalAudio(true);
        call.setLocalVideo(true);
        // Diagnostic: confirm the mic is actually live and sending.
        const localAudioOn = call.localAudio();
        const localTrack = call.participants().local?.tracks.audio;
        console.log('[useCallState] joined — localAudio:', localAudioOn, 'audio track state:', localTrack?.state);
        // Capture local tracks
        const participants = call.participants();
        const local = participants.local;
        if (local) {
          setState((s) => ({
            ...s,
            localTracks: {
              videoTrack: local.tracks.video.persistentTrack ?? null,
              audioTrack: local.tracks.audio.persistentTrack ?? null,
            },
          }));
        }
      });

      call.on('participant-joined', (event) => {
        if (!event) return;
        const p = event.participant;
        // The Tavus replica is a remote participant (not local)
        if (!p.local) {
          setState((s) => ({
            ...s,
            replicaTracks: {
              videoTrack: p.tracks.video?.persistentTrack ?? null,
              audioTrack: p.tracks.audio?.persistentTrack ?? null,
            },
          }));
        }
      });

      call.on('track-started', (event) => {
        if (!event) return;
        const { participant, track } = event;
        if (!participant || participant.local) return;

        setState((s) => {
          const updated = { ...s.replicaTracks };
          if (track.kind === 'video') updated.videoTrack = track;
          if (track.kind === 'audio') updated.audioTrack = track;
          return { ...s, replicaTracks: updated };
        });
      });

      call.on('track-stopped', (event) => {
        if (!event) return;
        const { participant, track } = event;
        if (!participant || participant.local) return;

        setState((s) => {
          const updated = { ...s.replicaTracks };
          if (track.kind === 'video' && s.replicaTracks.videoTrack === track) {
            updated.videoTrack = null;
          }
          if (track.kind === 'audio' && s.replicaTracks.audioTrack === track) {
            updated.audioTrack = null;
          }
          return { ...s, replicaTracks: updated };
        });
      });

      call.on('participant-updated', (event) => {
        if (!event) return;
        const p = event.participant;
        if (p.local) {
          setState((s) => ({
            ...s,
            localTracks: {
              videoTrack: p.tracks.video?.persistentTrack ?? null,
              audioTrack: p.tracks.audio?.persistentTrack ?? null,
            },
            // Reflect whether WE are sending audio, not subscription state.
            isMuted: !call.localAudio(),
          }));
        } else {
          setState((s) => ({
            ...s,
            replicaTracks: {
              videoTrack: p.tracks.video?.persistentTrack ?? s.replicaTracks.videoTrack,
              audioTrack: p.tracks.audio?.persistentTrack ?? s.replicaTracks.audioTrack,
            },
          }));
        }
      });

      call.on('participant-left', (event) => {
        if (!event) return;
        if (!event.participant.local) {
          // Replica left — conversation ended from Tavus side
          setState((s) => ({ ...s, stage: 'left' }));
        }
      });

      call.on('left-meeting', () => {
        setState((s) => ({ ...s, stage: 'left' }));
      });

      call.on('error', (event) => {
        console.error('[Daily] Error:', event);
        setState((s) => ({
          ...s,
          stage: 'error',
          error: (event as { errorMsg?: string })?.errorMsg ?? 'Call error',
        }));
      });

      // App messages from Tavus
      call.on('app-message', (event) => {
        if (!event) return;
        const data = event.data;
        console.log('[Daily app-message RAW]', JSON.stringify(data, null, 2));

        // Authoritative end-of-call signal from Tavus (replica ended the
        // conversation, max duration, or a left timeout). Move to 'left' so the
        // consumer's end-session flow runs even if the replica never leaves the
        // Daily room and no end_session tool call was emitted.
        const eventType =
          data && typeof data === 'object'
            ? (data as { event_type?: string }).event_type
            : undefined;
        if (eventType === TAVUS_EVENTS.SHUTDOWN || eventType === TAVUS_EVENTS.CONVERSATION_ENDED) {
          const reason =
            (data as { properties?: { shutdown_reason?: string } })?.properties?.shutdown_reason;
          console.log('[useCallState] Tavus end event → ending session:', eventType, reason ?? '');
          setState((s) => (s.stage === 'left' ? s : { ...s, stage: 'left' }));
        }

        if (appMessageHandlers.current.length === 0) {
          earlyMessages.current.push(data);
          return;
        }
        appMessageHandlers.current.forEach((h) => h(data));
      });

      // ── Join ───────────────────────────────────────────────────────────────
      await call.join({ url: conversationUrl });
    } catch (err) {
      console.error('[useCallState] Join error:', err);
      setState((s) => ({
        ...s,
        stage: 'error',
        error: err instanceof Error ? err.message : 'Failed to join call',
      }));
    }
  }, [conversationUrl]);

  const leave = useCallback(async () => {
    if (callRef.current) {
      try {
        await callRef.current.leave();
        callRef.current.destroy();
      } catch (e) {
        console.warn('[useCallState] Leave error:', e);
      }
      callRef.current = null;
    }
    setState((s) => ({ ...s, stage: 'left' }));
  }, []);

  const toggleMute = useCallback(async () => {
    if (!callRef.current) return;
    // localAudio() is the source of truth for whether we're sending mic audio.
    const audioOn = callRef.current.localAudio();
    callRef.current.setLocalAudio(!audioOn);
    setState((s) => ({ ...s, isMuted: audioOn }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callRef.current) {
        callRef.current.leave().catch(() => {});
        callRef.current.destroy();
        callRef.current = null;
      }
    };
  }, []);

  return { state, join, leave, toggleMute, onAppMessage };
}
