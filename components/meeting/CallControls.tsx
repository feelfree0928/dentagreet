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
    <div className="flex items-center justify-center gap-4 px-6 py-4 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700">
      {/* Mute button */}
      <button
        onClick={onToggleMute}
        disabled={disabled}
        title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150',
          isMuted
            ? 'bg-red-600 hover:bg-red-500 text-white'
            : 'bg-slate-700 hover:bg-slate-600 text-slate-100',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isMuted ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            Unmute
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
            Mute
          </>
        )}
      </button>

      {/* End session button */}
      <button
        onClick={onEndSession}
        disabled={disabled}
        title="End session"
        className={cn(
          'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-red-700 hover:bg-red-600 text-white transition-all duration-150 shadow-sm',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 3.75L18 6m0 0l2.25 2.25M18 6l2.25-2.25M18 6l-2.25 2.25m-10.5 6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.395C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
        </svg>
        End Session
      </button>
    </div>
  );
}
