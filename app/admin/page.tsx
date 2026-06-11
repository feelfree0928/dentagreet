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
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    declined: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    created: 'bg-slate-100 text-slate-600',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function ConsentCell({ consent }: { consent: boolean | null }) {
  if (consent === true) return <span className="text-green-600 font-semibold">✓</span>;
  if (consent === false) return <span className="text-red-500 font-semibold">✗</span>;
  return <span className="text-slate-300">—</span>;
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
      setSessions(data);
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-slate-800 px-8 py-6">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <h1 className="text-white font-semibold">Admin Access</h1>
              </div>
              <p className="text-slate-400 text-sm">DentaGreet Reception Records</p>
            </div>

            <form onSubmit={handleLogin} className="px-8 py-6 space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
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
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-50"
                />
                {loginError && (
                  <p className="mt-1.5 text-sm text-red-600">{loginError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loginLoading || !password}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
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

  // ── Sessions table ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-slate-800">DentaGreet Admin</h1>
            <p className="text-xs text-slate-400">Reception Records</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadSessions}
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-slate-500 hover:text-red-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-8 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-800">
            All Sessions
            <span className="ml-2 text-sm font-normal text-slate-400">({sessions.length})</span>
          </h2>
        </div>

        {sessionsLoading ? (
          <div className="flex items-center justify-center py-20">
            <svg className="w-8 h-8 animate-spin text-teal-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="font-medium">No sessions yet</p>
            <p className="text-sm mt-1">Sessions will appear here after patients complete reception</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Patient</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date & Time</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Consent</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Reason</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Duration</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rec</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/admin/sessions/${s.id}`)}
                    className="hover:bg-teal-50/50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3.5 font-medium text-slate-800">{s.patient_name}</td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDateTime(s.started_at)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                    <td className="px-5 py-3.5"><ConsentCell consent={s.consent} /></td>
                    <td className="px-5 py-3.5 text-slate-500 max-w-[200px] truncate">{s.reason_for_visit ?? '—'}</td>
                    <td className="px-5 py-3.5 text-slate-500">{sessionDuration(s.started_at, s.ended_at)}</td>
                    <td className="px-5 py-3.5">
                      {s.recording_path ? (
                        <span className="text-teal-600">●</span>
                      ) : (
                        <span className="text-slate-200">●</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
