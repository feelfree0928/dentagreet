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

const SEGMENT_UPLOAD_RETRIES = 3;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload one recording segment using the same three-step flow as before
 * (sign → direct Supabase upload → confirm), but parameterized by index so
 * each 10s segment lands at recordings/<id>/<index>.webm. Retries a few times
 * so a single transient failure doesn't lose the segment.
 */
async function uploadSegment(
  sessionId: string,
  blob: Blob,
  index: number
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < SEGMENT_UPLOAD_RETRIES; attempt++) {
    try {
      // 1. Signed upload URL — uploads the bytes DIRECTLY to Supabase Storage,
      //    bypassing Vercel's 4.5MB serverless request-body limit.
      const signRes = await fetch(`/api/sessions/${sessionId}/recording/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
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

      // 3. Confirm so the server appends the path to sessions.recording_segments.
      const confirmRes = await fetch(`/api/sessions/${sessionId}/recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, index }),
      });
      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Could not save recording path');
      }
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < SEGMENT_UPLOAD_RETRIES - 1) await delay(500 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Segment upload failed');
}

export function useRecording(sessionId: string) {
  const recorderRef = useRef<CompositeRecorder | null>(null);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Serializes segment uploads into a single promise chain so they land in
  // order and never overlap (which keeps the server-side array append safe).
  const uploadChainRef = useRef<Promise<void>>(Promise.resolve());
  const uploadFailedRef = useRef(false);

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

        uploadChainRef.current = Promise.resolve();
        uploadFailedRef.current = false;

        // Each emitted segment is appended to the upload chain so it uploads
        // in the background while the call continues.
        recorder.onSegment = (blob, index) => {
          uploadChainRef.current = uploadChainRef.current
            .then(() => uploadSegment(sessionId, blob, index))
            .catch((err) => {
              console.error(`[useRecording] Segment ${index} upload failed:`, err);
              uploadFailedRef.current = true;
              setError(err instanceof Error ? err.message : 'Segment upload failed');
              // Swallow so later segments still upload — a partial recording is
              // better than none.
            });
        };

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
    [sessionId]
  );

  const stopAndUpload = useCallback(async (): Promise<boolean> => {
    const recorder = recorderRef.current;
    if (!recorder) return false;

    setStatus('stopping');

    try {
      // Flushes the final partial segment via a last ondataavailable, which
      // enqueues it onto the upload chain.
      await recorder.stop();
      recorderRef.current = null;

      setStatus('uploading');

      // Wait for every queued segment (including the final one) to finish.
      await uploadChainRef.current;

      if (uploadFailedRef.current) {
        setStatus('error');
        return false;
      }

      setStatus('done');
      return true;
    } catch (err) {
      console.error('[useRecording] Stop/upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
      return false;
    }
  }, []);

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
