'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const firstName = name.trim().split(/\s+/)[0];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter your name to continue.');
      inputRef.current?.focus();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to start session');
      }

      router.push(`/meeting/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen mesh-bg flex flex-col overflow-hidden">
      {/* Floating ambient blobs */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-teal-300/30 blur-3xl animate-float" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-sky-300/25 blur-3xl animate-float" style={{ animationDelay: '-5s' }} />
      <div className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-emerald-300/25 blur-3xl animate-float" style={{ animationDelay: '-9s' }} />

      {/* Header */}
      <header className="relative z-10 px-6 sm:px-10 py-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(13,148,136,0.6)]">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.4}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">DentaGreet</span>
        <span className="ml-1 badge badge-success">AI Reception</span>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="app-card overflow-hidden animate-reveal">
            {/* Card header */}
            <div className="relative bg-gradient-to-br from-teal-700 via-teal-600 to-teal-500 px-8 py-8 overflow-hidden">
              <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <div className="relative flex items-center gap-3.5 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-white font-bold text-lg leading-tight">Welcome to DentaGreet</h1>
                  <p className="text-teal-100 text-sm">AI-Powered Dental Reception</p>
                </div>
              </div>
              <p className="relative text-teal-50/90 text-sm leading-relaxed">
                Our AI receptionist, Maya, will greet you, collect some information about your visit, and prepare the dental team before you arrive.
              </p>
            </div>

            {/* Form */}
            <div className="px-8 py-7">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="section-title mb-2 block">
                    Your full name
                  </label>
                  <p
                    key={firstName || 'Edward'}
                    className="greeting-animate mb-3 text-3xl font-extrabold tracking-tight"
                  >
                    Welcome, {firstName || 'Edward'}!
                  </p>
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    <input
                      ref={inputRef}
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setError(''); }}
                      placeholder="e.g. Jane Smith"
                      autoComplete="name"
                      autoFocus
                      disabled={loading}
                      className="field pl-11 text-base disabled:opacity-50"
                    />
                  </div>
                  {error && (
                    <p className="mt-2 text-sm text-rose-600 flex items-center gap-1.5">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </p>
                  )}
                </div>

                {/* Permissions note */}
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Camera &amp; microphone required.</strong> Your browser will ask for permission when you join. Please allow both to speak with Maya.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="btn btn-primary w-full py-3.5 text-base"
                >
                  {loading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Preparing your session…
                    </>
                  ) : (
                    <>
                      Join Reception
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              {/* Trust row */}
              <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                {[
                  { d: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z', t: 'Recorded' },
                  { d: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z', t: 'Private' },
                  { d: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z', t: 'Team reviewed' },
                ].map((it) => (
                  <div key={it.t} className="flex flex-col items-center gap-1.5 rounded-xl bg-slate-50/80 py-3 px-2">
                    <svg className="w-4.5 h-4.5 text-teal-600" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={it.d} />
                    </svg>
                    <span className="text-[11px] font-medium text-slate-500">{it.t}</span>
                  </div>
                ))}
              </div>

              {/* Privacy note */}
              <p className="mt-5 text-xs text-slate-400 text-center leading-relaxed">
                Maya will explain how your data is used and ask for your consent before collecting any information.
              </p>
            </div>
          </div>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-slate-400">
            Powered by{' '}
            <span className="font-medium text-slate-500">Tavus CVI</span>
            {' '}·{' '}
            <span className="font-medium text-slate-500">DentaGreet</span>
            {' '}prototype — not for clinical use
          </p>
        </div>
      </main>
    </div>
  );
}
