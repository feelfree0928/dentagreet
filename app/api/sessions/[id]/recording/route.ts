/**
 * POST /api/sessions/[id]/recording
 *
 * Receives the recorded WebM blob from the client and uploads it to
 * Supabase Storage under recordings/{sessionId}.webm
 * Then updates sessions.recording_path.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const maxDuration = 60; // allow up to 60s for large blob uploads

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

    // Read the raw blob from the request body
    const blob = await req.blob();

    if (!blob || blob.size === 0) {
      return NextResponse.json({ error: 'Empty recording blob' }, { status: 400 });
    }

    // Cap at ~150MB (10 min @ ~2Mbps)
    const MAX_SIZE = 150 * 1024 * 1024;
    if (blob.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Recording too large' }, { status: 413 });
    }

    const storagePath = `recordings/${id}.webm`;
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage (private bucket: recordings)
    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(storagePath, buffer, {
        contentType: blob.type || 'video/webm',
        upsert: true, // allow re-upload if session was retried
      });

    if (uploadError) {
      console.error('[/api/sessions/[id]/recording] Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Storage upload failed', details: uploadError.message }, { status: 500 });
    }

    // Update recording_path in sessions table
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ recording_path: storagePath })
      .eq('id', id);

    if (updateError) {
      console.error('[/api/sessions/[id]/recording] DB update error:', updateError);
      // Don't fail — recording is uploaded, just path not saved
    }

    return NextResponse.json({ ok: true, path: storagePath });
  } catch (err) {
    console.error('[/api/sessions/[id]/recording] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
