/**
 * POST /api/sessions/[id]/recording
 *
 * Confirms one recording SEGMENT that the client has already uploaded directly
 * to Supabase Storage (via a signed upload URL — see ./sign) and appends its
 * path to sessions.recording_segments. Body: { path, index }. This receives a
 * small JSON body, NOT the video bytes, so it stays well under Vercel's 4.5MB
 * serverless request-body limit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { recordingSegmentName, recordingSegmentPath } from '@/lib/utils';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { path, index } = (await req.json().catch(() => ({}))) as {
      path?: string;
      index?: number;
    };

    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
      return NextResponse.json({ error: 'Invalid segment index' }, { status: 400 });
    }

    // Only accept the canonical path for this session/index — don't trust
    // arbitrary client-supplied paths.
    const expectedPath = recordingSegmentPath(id, index);
    if (path !== expectedPath) {
      return NextResponse.json({ error: 'Invalid recording path' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Verify the object actually exists in storage before recording the path.
    const segmentName = recordingSegmentName(index);
    const { data: files, error: listError } = await supabase.storage
      .from('recordings')
      .list(`recordings/${id}`, { search: segmentName });

    if (listError) {
      console.error('[/api/sessions/[id]/recording] Storage list error:', listError);
      return NextResponse.json({ error: 'Storage check failed' }, { status: 500 });
    }

    const exists = files?.some((f) => f.name === segmentName);
    if (!exists) {
      return NextResponse.json({ error: 'Recording not found in storage' }, { status: 404 });
    }

    // Append this segment's path to the ordered array. Client uploads are
    // serialized, so this read-modify-write doesn't race; the sort keeps the
    // array ordered by zero-padded index even if a segment arrives late.
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('recording_segments')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const current = Array.isArray(session.recording_segments)
      ? (session.recording_segments as string[])
      : [];

    if (!current.includes(expectedPath)) {
      const next = [...current, expectedPath].sort();
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ recording_segments: next })
        .eq('id', id);

      if (updateError) {
        console.error('[/api/sessions/[id]/recording] DB update error:', updateError);
        return NextResponse.json({ error: 'Could not save recording path' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true, path: expectedPath });
  } catch (err) {
    console.error('[/api/sessions/[id]/recording] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
