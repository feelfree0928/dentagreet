/**
 * POST /api/sessions/[id]/recording/sign
 *
 * Issues a short-lived signed upload URL so the browser can upload one
 * recording SEGMENT directly to Supabase Storage, bypassing Vercel's 4.5MB
 * serverless request-body limit. Body: { index: number }. The segment lands
 * at recordings/<id>/<index>.webm and the client confirms it via
 * POST /api/sessions/[id]/recording.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { recordingSegmentPath } from '@/lib/utils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { index } = (await req.json().catch(() => ({}))) as { index?: number };
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: 'Invalid segment index' }, { status: 400 });
    }

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

    const storagePath = recordingSegmentPath(id, index);

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
