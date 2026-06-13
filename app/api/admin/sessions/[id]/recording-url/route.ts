/**
 * GET /api/admin/sessions/[id]/recording-url
 *
 * Generates short-lived signed URLs for the session recording segments (in
 * order), so the admin client can download and concatenate them into one
 * continuous video. Falls back to a single legacy recording_path file.
 * Returns { urls: string[] }. Requires admin_session cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase-server';

async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('admin_session')?.value === 'authenticated';
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = createServerSupabaseClient();

  // Fetch both the segmented recording and the legacy single-file path.
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('recording_path, recording_segments')
    .eq('id', id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Prefer the segmented recording; fall back to the legacy single file.
  const segments = Array.isArray(session.recording_segments)
    ? (session.recording_segments as string[])
    : [];
  const paths = segments.length > 0
    ? segments
    : session.recording_path
      ? [session.recording_path]
      : [];

  if (paths.length === 0) {
    return NextResponse.json({ urls: [], url: null, message: 'No recording available' });
  }

  // Sign each segment path (valid for 1 hour), preserving order.
  const urls: string[] = [];
  for (const path of paths) {
    const { data: signedData, error: signError } = await supabase.storage
      .from('recordings')
      .createSignedUrl(path, 3600);

    if (signError || !signedData?.signedUrl) {
      console.error('[recording-url] Signed URL error:', signError);
      return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 });
    }
    urls.push(signedData.signedUrl);
  }

  return NextResponse.json({ urls });
}
