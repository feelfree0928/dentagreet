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

      if (!blob || blob.size === 0) {
        throw new Error('Recording is empty');
      }

      setStatus('uploading');

      // 1. Ask the server for a signed upload URL. This lets us upload the
      //    video bytes DIRECTLY to Supabase Storage, bypassing Vercel's
      //    4.5MB serverless request-body limit (a Route Handler POST of the
      //    blob fails with 413 for any recording longer than ~20s).
      const signRes = await fetch(`/api/sessions/${sessionId}/recording/sign`, {
        method: 'POST',
      });
      if (!signRes.ok) {
        const data = await signRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not get upload URL');
      }
      const { path, token } = (await signRes.json()) as { path: string; token: string };

      // 2. Upload straight to Supabase Storage using the signed token.
      const { getBrowserSupabaseClient } = await import('@/lib/supabase-browser');
      const supabase = getBrowserSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .uploadToSignedUrl(path, token, blob, {
          contentType: blob.type || 'video/webm',
        });
      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // 3. Confirm the path so the server records sessions.recording_path.
      const confirmRes = await fetch(`/api/sessions/${sessionId}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save recording path');
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
