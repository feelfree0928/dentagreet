'use client';

/**
 * hooks/useRecording.ts
 *
 * Manages the CompositeRecorder lifecycle.
 * Exposes start, stop, upload, and status.
 */

import { useRef, useState, useCallback } from 'react';
import type { CompositeRecorder } from '@/lib/recording';

export type RecordingStatus =
  | 'idle'
  | 'recording'
  | 'stopping'
  | 'uploading'
  | 'done'
  | 'error';

export function useRecording(sessionId: string) {
  const recorderRef = useRef<CompositeRecorder | null>(null);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(
    async (
      replicaVideo: HTMLVideoElement | null,
      patientVideo: HTMLVideoElement | null,
      replicaAudioTrack: MediaStreamTrack | null,
      patientAudioTrack: MediaStreamTrack | null
    ) => {
      if (recorderRef.current?.isRecording) return;

      try {
        // Dynamic import — recording.ts uses browser APIs
        const { CompositeRecorder } = await import('@/lib/recording');
        const recorder = new CompositeRecorder(
          replicaVideo,
          patientVideo,
          replicaAudioTrack,
          patientAudioTrack
        );
        recorderRef.current = recorder;
        await recorder.start();
        setStatus('recording');
        setError(null);
      } catch (err) {
        console.error('[useRecording] Start error:', err);
        setError(err instanceof Error ? err.message : 'Recording failed to start');
        setStatus('error');
      }
    },
    []
  );

  const stopAndUpload = useCallback(async (): Promise<boolean> => {
    const recorder = recorderRef.current;
    if (!recorder) return false;

    setStatus('stopping');

    try {
      const blob = await recorder.stop();
      recorderRef.current = null;

      setStatus('uploading');

      const res = await fetch(`/api/sessions/${sessionId}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'video/webm' },
        body: blob,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Upload failed');
      }

      setStatus('done');
      return true;
    } catch (err) {
      console.error('[useRecording] Stop/upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
      return false;
    }
  }, [sessionId]);

  const updateSources = useCallback(
    (
      replicaVideo: HTMLVideoElement | null,
      patientVideo: HTMLVideoElement | null,
      replicaAudioTrack: MediaStreamTrack | null,
      patientAudioTrack: MediaStreamTrack | null
    ) => {
      recorderRef.current?.updateSources(
        replicaVideo,
        patientVideo,
        replicaAudioTrack,
        patientAudioTrack
      );
    },
    []
  );

  return { status, error, start, stopAndUpload, updateSources };
}
