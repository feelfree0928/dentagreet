/**
 * POST /api/tavus/webhook
 *
 * Receives Tavus conversation callbacks (conversation ended, transcription ready).
 * The app works fully without this webhook (client events are source of truth).
 * This is a bonus path for when the app is publicly deployed.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('[Tavus Webhook] Received:', JSON.stringify(body, null, 2));

    const eventType: string = body.event_type ?? body.type ?? '';
    const conversationId: string = body.conversation_id ?? '';

    if (!conversationId) {
      return NextResponse.json({ ok: true }); // ignore malformed
    }

    const supabase = createServerSupabaseClient();

    // Find session by Tavus conversation ID
    const { data: session } = await supabase
      .from('sessions')
      .select('id, transcript, status')
      .eq('tavus_conversation_id', conversationId)
      .single();

    if (!session) {
      console.warn('[Tavus Webhook] No session found for conversation:', conversationId);
      return NextResponse.json({ ok: true });
    }

    // ── Handle conversation ended ─────────────────────────────────────────────
    if (
      eventType === 'conversation.ended' ||
      eventType === 'conversation_ended'
    ) {
      if (session.status !== 'completed' && session.status !== 'declined') {
        await supabase
          .from('sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', session.id);
      }
    }

    // ── Handle full transcript from webhook ───────────────────────────────────
    if (body.transcript && Array.isArray(body.transcript)) {
      // Merge webhook transcript with existing (client may have captured more)
      const webhookTranscript = body.transcript.map(
        (entry: { role?: string; text?: string; timestamp?: string }) => ({
          role: entry.role === 'assistant' || entry.role === 'replica' ? 'replica' : 'user',
          text: entry.text ?? '',
          ts: entry.timestamp ?? new Date().toISOString(),
        })
      );

      // Only update if webhook has more entries
      const existingTranscript = Array.isArray(session.transcript) ? session.transcript : [];
      if (webhookTranscript.length > existingTranscript.length) {
        await supabase
          .from('sessions')
          .update({ transcript: webhookTranscript })
          .eq('id', session.id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Tavus Webhook] Error:', err);
    // Always return 200 to Tavus to prevent retries
    return NextResponse.json({ ok: true });
  }
}
