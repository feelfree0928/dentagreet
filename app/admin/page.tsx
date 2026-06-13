'use client';

/**
 * app/admin/page.tsx
 *
 * Admin gate + sessions table.
 * Password checked server-side via /api/admin/login.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, sessionDuration } from '@/lib/utils';

interface SessionRow {
  id: string;
  patient_name: string;
  status: string;
  consent: boolean | null;
  reason_for_visit: string | null;
  started_at: string;
  ended_at: string | null;
  recording_path: string | null;
  recording_segments: string[] | null;
}

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

function ConsentCell({ consent }: { consent: boolean | null }) {
  if (consent === true)
    return (
      <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70 text-xs font-bold">✓</span>
    );
  if (consent === false)
    return (
      <span className="inline-flex w-6 h-6 items-center justify-center rounded-full bg-rose-50 text-rose-500 ring-1 ring-rose-200/70 text-xs font-bold">✗</span>
    );
  return <span className="text-slate-300">—</span>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

function StatCard({ label, value, icon, tint }: { label: string; value: string; icon: string; tint: string }) {
  return (
    <div className="app-card p-4 flex items-center gap-3.5">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${tint}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-2xl font-extrabold text-slate-800 leading-none tracking-tight">{value}</p>
        <p className="section-title mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Try to load sessions (will 401 if not authenticated)
  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const res = await fetch('/api/admin/sessions');
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
      setIsAuthenticated(true);
    } catch {
      // ignore
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        setLoginError('Invalid password. Please try again.');
        return;
      }

      setIsAuthenticated(true);
      setPassword('');
      loadSessions();
    } catch {
      setLoginError('Network error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setIsAuthenticated(false);
    setSessions([]);
  }

  // ── Login form ─────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen mesh-bg flex items-center justify-center px-4 overflow-hidden">
        <div className="pointer-events-none absolute -top-24 -left-20 h-80 w-80 rounded-full bg-teal-300/30 blur-3xl animate-float" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-sky-300/25 blur-3xl animate-float" style={{ animationDelay: '-6s' }} />
        <div className="relative w-full max-w-sm">
          <div className="app-card overflow-hidden animate-reveal">
            <div className="relative bg-gradient-to-br from-slate-800 to-slate-700 px-8 py-7 overflow-hidden">
              <div className="pointer-events-none absolute -top-8 -right-6 h-32 w-32 rounded-full bg-teal-400/15 blur-2xl" />
              <div className="relative flex items-center gap-2.5 mb-1.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 ring-1 ring-teal-400/30 flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h1 className="text-white font-bold text-lg">Admin Access</h1>
              </div>
              <p className="relative text-slate-300 text-sm">DentaGreet Reception Records</p>
            </div>

            <form onSubmit={handleLogin} className="px-8 py-7 space-y-4">
              <div>
                <label htmlFor="password" className="section-title mb-2 block">
                  Admin Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                  placeholder="Enter admin password"
                  autoFocus
                  disabled={loginLoading}
                  className="field disabled:opacity-50"
                />
                {loginError && (
                  <p className="mt-2 text-sm text-rose-600 flex items-center gap-1.5">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    {loginError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loginLoading || !password}
                className="btn btn-primary w-full"
              >
                {loginLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                Sign In
              </button>
            </form>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">
            Prototype-grade auth — see README for production roadmap
          </p>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const total = sessions.length;
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const consented = sessions.filter((s) => s.consent === true).length;
  const recorded = sessions.filter((s) => (s.recording_segments?.length ?? 0) > 0 || s.recording_path).length;
  const hasRec = (s: SessionRow) => (s.recording_segments?.length ?? 0) > 0 || !!s.recording_path;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-slate-200/80 px-5 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(13,148,136,0.6)]">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-slate-800 leading-tight">DentaGreet Admin</h1>
            <p className="text-xs text-slate-400">Reception Records</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={loadSessions} className="btn btn-ghost px-3 py-2 text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button onClick={handleLogout} className="btn btn-ghost px-3 py-2 text-sm hover:text-rose-600">
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-5 sm:px-8 py-6 max-w-7xl mx-auto">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total sessions" value={String(total)} tint="bg-teal-50 text-teal-600" icon="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
          <StatCard label="Completed" value={String(completed)} tint="bg-emerald-50 text-emerald-600" icon="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <StatCard label="Consent granted" value={String(consented)} tint="bg-sky-50 text-sky-600" icon="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          <StatCard label="Recordings" value={String(recorded)} tint="bg-violet-50 text-violet-600" icon="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800">
            All Sessions
            <span className="ml-2 text-sm font-medium text-slate-400">({sessions.length})</span>
          </h2>
        </div>

        {sessionsLoading ? (
          <div className="app-card overflow-hidden">
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="skeleton w-9 h-9 rounded-full" />
                  <div className="skeleton h-3.5 w-32 rounded" />
                  <div className="skeleton h-3.5 w-40 rounded hidden sm:block" />
                  <div className="skeleton h-5 w-20 rounded-full ml-auto" />
                </div>
              ))}
            </div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="app-card text-center py-20 text-slate-400">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
              <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <p className="font-semibold text-slate-600">No sessions yet</p>
            <p className="text-sm mt-1">Sessions will appear here after patients complete reception</p>
          </div>
        ) : (
          <div className="app-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="text-left px-5 py-3 section-title">Patient</th>
                    <th className="text-left px-5 py-3 section-title">Date &amp; Time</th>
                    <th className="text-left px-5 py-3 section-title">Status</th>
                    <th className="text-left px-5 py-3 section-title">Consent</th>
                    <th className="text-left px-5 py-3 section-title">Reason</th>
                    <th className="text-left px-5 py-3 section-title">Duration</th>
                    <th className="text-left px-5 py-3 section-title">Rec</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => router.push(`/admin/sessions/${s.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/admin/sessions/${s.id}`); }}
                      className="group hover:bg-teal-50/40 focus:bg-teal-50/60 outline-none cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-400 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                            {initials(s.patient_name)}
                          </span>
                          <span className="font-semibold text-slate-800">{s.patient_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{formatDateTime(s.started_at)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                      <td className="px-5 py-3.5"><ConsentCell consent={s.consent} /></td>
                      <td className="px-5 py-3.5 text-slate-500 max-w-[220px] truncate">{s.reason_for_visit ?? '—'}</td>
                      <td className="px-5 py-3.5 text-slate-500 font-mono text-xs">{sessionDuration(s.started_at, s.ended_at)}</td>
                      <td className="px-5 py-3.5">
                        {hasRec(s) ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                            <span className="w-2 h-2 rounded-full bg-teal-500" /> Yes
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
