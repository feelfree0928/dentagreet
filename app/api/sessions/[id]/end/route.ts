/**
 * POST /api/sessions/[id]/end
 *
 * Ends the Tavus conversation and marks the session as completed/declined.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json().catch(() => ({}));
    const finalStatus: string = body.status ?? 'completed';

    const supabase = createServerSupabaseClient();

    // Fetch the session to get the Tavus conversation ID
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('tavus_conversation_id, status')
      .eq('id', id)
      .single();

    if (fetchError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Don't double-end
    if (session.status === 'completed' || session.status === 'declined') {
      return NextResponse.json({ ok: true, alreadyEnded: true });
    }

    // ── End Tavus conversation ────────────────────────────────────────────────
    if (session.tavus_conversation_id) {
      const tavusRes = await fetch(
        `https://tavusapi.com/v2/conversations/${session.tavus_conversation_id}/end`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.TAVUS_API_KEY!,
          },
        }
      );

      if (!tavusRes.ok) {
        const errData = await tavusRes.json().catch(() => ({}));
        // Log but don't fail — we still want to update our DB
        console.warn('[/api/sessions/[id]/end] Tavus end error:', errData);
      }
    }

    // ── Update session in DB ──────────────────────────────────────────────────
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        status: finalStatus,
        ended_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[/api/sessions/[id]/end] DB update error:', updateError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/sessions/[id]/end] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
