/**
 * GET  /api/admin/sessions/[id]/soap  — return the cached SOAP note + consent-language
 *      analysis, generating + caching it on first access. Returns
 *      { soap_note: null, consent_language: null, reason: 'no_transcript' } if the
 *      session has no transcript (no Claude call made).
 * POST /api/admin/sessions/[id]/soap  — force regeneration (the "Regenerate" button).
 *
 * Requires the admin_session cookie. Generation runs server-side via the Claude
 * API (see lib/soap.ts) and writes the result back onto the sessions row.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateSoapAnalysis, SOAP_MODEL } from '@/lib/soap';
import type { Session, SoapNote, ConsentLanguage } from '@/lib/database.types';

async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

async function loadSession(id: string): Promise<Session | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();
  if (error || !data) return null;
  return data as Session;
}

/** Generate, persist, and return the analysis for a session. */
async function generateAndStore(session: Session) {
  const { soap, consentLanguage } = await generateSoapAnalysis(session);
  const generated_at = new Date().toISOString();

  const soap_note: SoapNote = { ...soap, generated_at, model: SOAP_MODEL };
  const consent_language: ConsentLanguage = { ...consentLanguage, generated_at, model: SOAP_MODEL };

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('sessions')
    .update({ soap_note, consent_language })
    .eq('id', session.id);
  if (error) {
    console.error('[/api/admin/sessions/[id]/soap] DB update error:', error);
    throw new Error('Could not save analysis');
  }

  return { soap_note, consent_language };
}

function hasTranscript(session: Session): boolean {
  return Array.isArray(session.transcript) && session.transcript.length > 0;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const session = await loadSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Serve the cached analysis if present.
  if (session.soap_note && session.consent_language) {
    return NextResponse.json({
      soap_note: session.soap_note,
      consent_language: session.consent_language,
    });
  }

  if (!hasTranscript(session)) {
    return NextResponse.json({ soap_note: null, consent_language: null, reason: 'no_transcript' });
  }

  try {
    const result = await generateAndStore(session);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/admin/sessions/[id]/soap] GET generate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const session = await loadSession(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (!hasTranscript(session)) {
    return NextResponse.json({ soap_note: null, consent_language: null, reason: 'no_transcript' });
  }

  try {
    const result = await generateAndStore(session);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[/api/admin/sessions/[id]/soap] POST regenerate error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
