/**
 * POST /api/sessions/[id]/recording/sign
 *
 * Issues a short-lived signed upload URL so the browser can upload the
 * recording blob DIRECTLY to Supabase Storage, bypassing Vercel's 4.5MB
 * serverless request-body limit. The client then confirms the stored path
 * via POST /api/sessions/[id]/recording.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const supabase = createServerSupabaseClient();

    // Verify session exists
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const storagePath = `recordings/${id}.webm`;

    const { data, error } = await supabase.storage
      .from('recordings')
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (error || !data) {
      console.error('[/api/sessions/[id]/recording/sign] Sign error:', error);
      return NextResponse.json(
        { error: 'Could not create upload URL', details: error?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ path: data.path, token: data.token });
  } catch (err) {
    console.error('[/api/sessions/[id]/recording/sign] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
