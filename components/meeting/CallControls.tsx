'use client';

/**
 * components/meeting/CallControls.tsx
 *
 * Bottom control bar: mute mic + end session.
 */

import { cn } from '@/lib/utils';

interface CallControlsProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onEndSession: () => void;
  disabled?: boolean;
}

export function CallControls({
  isMuted,
  onToggleMute,
  onEndSession,
  disabled = false,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-8 px-6 py-4 glass border-t border-white/10">
      {/* Mute button */}
      <button
        onClick={onToggleMute}
        disabled={disabled}
        title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        className="group flex flex-col items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-2xl transition-all duration-200 ring-1',
            'group-active:scale-95',
            isMuted
              ? 'bg-rose-500/90 ring-rose-300/40 text-white shadow-[0_8px_24px_-8px_rgba(244,63,94,0.6)]'
              : 'bg-white/10 ring-white/15 text-slate-100 group-hover:bg-white/20'
          )}
          style={{ width: 52, height: 52 }}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          )}
        </span>
        <span className="text-[11px] font-medium text-slate-300">{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>

      {/* End session button */}
      <button
        onClick={onEndSession}
        disabled={disabled}
        title="End session"
        className="group flex flex-col items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span
          className="flex items-center justify-center rounded-2xl text-white transition-all duration-200 ring-1 ring-rose-300/40 group-hover:brightness-110 group-active:scale-95"
          style={{ width: 52, height: 52, backgroundImage: 'linear-gradient(135deg,#e11d48,#f43f5e)', boxShadow: '0 10px 26px -8px rgba(225,29,72,0.6)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m-10.5 6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
          </svg>
        </span>
        <span className="text-[11px] font-medium text-rose-300">End</span>
      </button>
    </div>
  );
}
