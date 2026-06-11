/**
 * GET /api/admin/sessions/[id]/recording-url
 *
 * Generates a short-lived signed URL for the session recording.
 * Requires admin_session cookie.
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

  // Fetch recording_path from session
  const { data: session, error: fetchError } = await supabase
    .from('sessions')
    .select('recording_path')
    .eq('id', id)
    .single();

  if (fetchError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (!session.recording_path) {
    return NextResponse.json({ url: null, message: 'No recording available' });
  }

  // Generate a signed URL valid for 1 hour
  const { data: signedData, error: signError } = await supabase.storage
    .from('recordings')
    .createSignedUrl(session.recording_path, 3600);

  if (signError || !signedData?.signedUrl) {
    console.error('[recording-url] Signed URL error:', signError);
    return NextResponse.json({ error: 'Could not generate signed URL' }, { status: 500 });
  }

  return NextResponse.json({ url: signedData.signedUrl });
}
