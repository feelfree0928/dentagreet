'use client';

/**
 * components/meeting/HairCheck.tsx
 *
 * Pre-join camera/mic preview screen.
 * Shows camera feed + mic level indicator.
 * Requires explicit "Start" click (satisfies browser autoplay + getUserMedia policies).
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface HairCheckProps {
  patientName: string;
  onStart: () => void;
  onError: (msg: string) => void;
}

export function HairCheck({ patientName, onStart, onError }: HairCheckProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);

  const [permissionState, setPermissionState] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function requestPermissions() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true,
        });

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Mic level analyser
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        function tick() {
          if (!mounted) return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setMicLevel(Math.min(100, (avg / 128) * 100));
          animRef.current = requestAnimationFrame(tick);
        }
        tick();

        setPermissionState('granted');
      } catch (err) {
        if (!mounted) return;
        console.error('[HairCheck] getUserMedia error:', err);
        setPermissionState('denied');
        const name = err instanceof DOMException ? err.name : '';
        let message: string;
        switch (name) {
          case 'NotFoundError':
          case 'OverconstrainedError':
            message =
              'No camera or microphone was found on this device. Please connect both and refresh.';
            break;
          case 'NotReadableError':
          case 'AbortError':
            message =
              'Your camera or microphone is already in use by another app. Close it and refresh.';
            break;
          case 'NotAllowedError':
          case 'SecurityError':
            message =
              'Camera or microphone access was blocked. Please allow both in your browser settings and refresh.';
            break;
          default:
            message =
              'Could not access your camera and microphone. Please check your devices and refresh.';
        }
        onError(message);
      }
    }

    requestPermissions();

    return () => {
      mounted = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onError]);

  function handleStart() {
    // Stop the preview stream — Daily will re-acquire the tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (animRef.current) cancelAnimationFrame(animRef.current);
    onStart();
  }

  const micBars = Array.from({ length: 12 });

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-md bg-teal-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-white font-semibold text-lg">DentaGreet</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">
          Ready to join, {patientName}?
        </h1>
        <p className="text-slate-400 text-sm">
          Check your camera and microphone before starting
        </p>
      </div>

      {/* Camera preview */}
      <div className="relative w-full max-w-md aspect-video bg-slate-800 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 mb-6">
        {permissionState === 'pending' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <svg className="w-8 h-8 text-slate-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-slate-400 text-sm">Requesting camera access…</p>
          </div>
        )}

        {permissionState === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 01-2.25-2.25V9m12.841 9.091L16.5 19.5m-1.409-1.409c.407-.407.659-.97.659-1.591v-9a2.25 2.25 0 00-2.25-2.25h-9c-.621 0-1.184.252-1.591.659m12.182 12.182L2.909 5.909M1.5 4.5l1.409 1.409" />
            </svg>
            <p className="text-red-300 text-sm font-medium">Camera access denied</p>
            <p className="text-slate-400 text-xs">Please allow camera and microphone in your browser settings, then refresh.</p>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn(
            'w-full h-full object-cover scale-x-[-1]', // mirror for natural feel
            permissionState !== 'granted' && 'hidden'
          )}
        />

        {/* Camera label */}
        {permissionState === 'granted' && (
          <div className="absolute top-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            Camera on
          </div>
        )}
      </div>

      {/* Mic level */}
      {permissionState === 'granted' && (
        <div className="flex items-center gap-3 mb-8">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
          </svg>
          <div className="flex items-end gap-0.5 h-6">
            {micBars.map((_, i) => {
              const threshold = (i / micBars.length) * 100;
              const active = micLevel > threshold;
              return (
                <div
                  key={i}
                  className={cn(
                    'w-1.5 rounded-full transition-all duration-75',
                    active ? 'bg-teal-400' : 'bg-slate-600'
                  )}
                  style={{ height: `${40 + i * 5}%` }}
                />
              );
            })}
          </div>
          <span className="text-slate-400 text-xs">Microphone active</span>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={permissionState !== 'granted'}
        className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold px-10 py-4 rounded-xl text-lg transition-all duration-150 shadow-lg hover:shadow-teal-500/25 flex items-center gap-3"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
        </svg>
        Start Reception
      </button>

      <p className="mt-4 text-slate-500 text-xs text-center max-w-xs">
        By clicking Start, you agree to allow this session to be recorded for quality and training purposes (Mia will confirm your consent).
      </p>
    </div>
  );
}
