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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-slate-50 flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center gap-3 border-b border-teal-100/60">
        <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <span className="text-xl font-semibold text-slate-800 tracking-tight">DentaGreet</span>
        <span className="ml-2 text-xs font-medium text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
          AI Reception
        </span>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
            {/* Card header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-8 py-7">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-white font-semibold text-lg leading-tight">Welcome to DentaGreet</h1>
                  <p className="text-teal-100 text-sm">AI-Powered Dental Reception</p>
                </div>
              </div>
              <p className="text-teal-50 text-sm leading-relaxed">
                Our AI receptionist, Maya, will greet you, collect some information about your visit, and prepare the dental team before you arrive.
              </p>
            </div>

            {/* Form */}
            <div className="px-8 py-7">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Your full name
                  </label>
                  <p
                    key={firstName || 'Edward'}
                    className="greeting-animate mb-2 text-2xl font-extrabold tracking-tight"
                  >
                    Welcome, {firstName || 'Edward'}!
                  </p>
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all disabled:opacity-50 text-base"
                  />
                  {error && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      {error}
                    </p>
                  )}
                </div>

                {/* Permissions note */}
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Camera & microphone required.</strong> Your browser will ask for permission when you join. Please allow both to speak with Maya.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 text-base shadow-sm hover:shadow-md"
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
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      Join Reception
                    </>
                  )}
                </button>
              </form>

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
