/**
 * POST /api/sessions/[id]/recording
 *
 * Confirms the storage path of a recording that the client has already
 * uploaded directly to Supabase Storage (via a signed upload URL — see
 * ./sign). This receives a small JSON body, NOT the video bytes, so it
 * stays well under Vercel's 4.5MB serverless request-body limit.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const { path } = (await req.json().catch(() => ({}))) as { path?: string };

    // Only accept the canonical path for this session — don't trust arbitrary
    // client-supplied paths.
    const expectedPath = `recordings/${id}.webm`;
    if (path !== expectedPath) {
      return NextResponse.json({ error: 'Invalid recording path' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Verify the object actually exists in storage before recording the path.
    const { data: files, error: listError } = await supabase.storage
      .from('recordings')
      .list('recordings', { search: `${id}.webm` });

    if (listError) {
      console.error('[/api/sessions/[id]/recording] Storage list error:', listError);
      return NextResponse.json({ error: 'Storage check failed' }, { status: 500 });
    }

    const exists = files?.some((f) => f.name === `${id}.webm`);
    if (!exists) {
      return NextResponse.json({ error: 'Recording not found in storage' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ recording_path: expectedPath })
      .eq('id', id);

    if (updateError) {
      console.error('[/api/sessions/[id]/recording] DB update error:', updateError);
      return NextResponse.json({ error: 'Could not save recording path' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, path: expectedPath });
  } catch (err) {
    console.error('[/api/sessions/[id]/recording] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
