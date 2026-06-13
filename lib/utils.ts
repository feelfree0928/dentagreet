/**
 * lib/utils.ts — Shared utility helpers
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a duration in seconds to mm:ss */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Format an ISO timestamp to a human-readable date/time */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Format an ISO timestamp to a short time */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** Compute session duration string from started_at and ended_at */
export function sessionDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return '—';
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  return formatDuration(totalSeconds);
}

/** Debounce a function */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** Capitalize first letter */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Convert snake_case to Title Case */
export function snakeToTitle(str: string): string {
  return str
    .split('_')
    .map(capitalize)
    .join(' ');
}

/**
 * Storage object name for a single recording segment, e.g. "0007.webm".
 * Zero-padded so segments sort lexically in upload order.
 */
export function recordingSegmentName(index: number): string {
  return `${String(index).padStart(4, '0')}.webm`;
}

/**
 * Full Supabase Storage path for a recording segment, e.g.
 * "recordings/<sessionId>/0007.webm". Used by the sign/confirm routes and the
 * admin playback route so the naming scheme stays in one place.
 */
export function recordingSegmentPath(sessionId: string, index: number): string {
  return `recordings/${sessionId}/${recordingSegmentName(index)}`;
}

/** Check if MediaRecorder supports a given MIME type, with fallback */
export function getSupportedMimeType(): string {
  const types = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    'video/mp4',
  ];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}
