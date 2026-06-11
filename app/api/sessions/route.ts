/**
 * POST /api/sessions
 *
 * Creates a new reception session:
 * 1. Creates a Tavus conversation
 * 2. Inserts a sessions row in Supabase
 * 3. Returns { sessionId, conversationUrl }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientName: string = (body.patientName ?? '').trim();

    if (!patientName) {
      return NextResponse.json({ error: 'patientName is required' }, { status: 400 });
    }

    // ── 1. Create Tavus conversation ─────────────────────────────────────────
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');

    const tavusPayload: Record<string, unknown> = {
      replica_id: process.env.TAVUS_REPLICA_ID,
      persona_id: process.env.TAVUS_PERSONA_ID,
      conversation_name: `Reception – ${patientName}`,
      conversational_context: `The patient's name is ${patientName}. The clinic is DentaGreet. Treat this as ground truth and greet them by name.`,
      custom_greeting: `Hi ${patientName}, welcome to DentaGreet! I'm Maya, the clinic's virtual receptionist.`,
      properties: {
        max_call_duration: 600,          // 10 minutes max
        participant_left_timeout: 30,    // end if patient leaves for 30s
        language: 'english',
        enable_recording: false,         // we do client-side canvas recording → Supabase
        // Note: utterance app-messages come automatically from the persona's STT
        // layer (default tavus-auto). There is no `enable_transcription` property.
      },
    };

    // Only set callback_url when publicly reachable (not localhost)
    if (!isLocalhost) {
      tavusPayload.callback_url = `${appUrl}/api/tavus/webhook`;
    }

    const tavusRes = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.TAVUS_API_KEY!,
      },
      body: JSON.stringify(tavusPayload),
    });

    const tavusData = await tavusRes.json();

    if (!tavusRes.ok) {
      console.error('[/api/sessions] Tavus error:', tavusRes.status, tavusData);
      // Surface Tavus's actual message (e.g. "out of conversational credits",
      // "maximum concurrent conversations") instead of a generic failure.
      const tavusMessage =
        typeof tavusData?.message === 'string'
          ? tavusData.message
          : 'Failed to create Tavus conversation';
      // Pass through 4xx (credits/limits/auth — client-actionable) as-is;
      // treat anything else as a 502 upstream failure.
      const status = tavusRes.status >= 400 && tavusRes.status < 500 ? tavusRes.status : 502;
      return NextResponse.json({ error: tavusMessage, details: tavusData }, { status });
    }

    const conversationId: string = tavusData.conversation_id;
    const conversationUrl: string = tavusData.conversation_url;

    if (!conversationId || !conversationUrl) {
      console.error('[/api/sessions] Unexpected Tavus response:', tavusData);
      return NextResponse.json(
        { error: 'Tavus response missing conversation_id or conversation_url' },
        { status: 502 }
      );
    }

    // ── 2. Insert session row ────────────────────────────────────────────────
    const supabase = createServerSupabaseClient();

    const { data: session, error: dbError } = await supabase
      .from('sessions')
      .insert({
        patient_name: patientName,
        tavus_conversation_id: conversationId,
        tavus_conversation_url: conversationUrl,
        status: 'created',
        intake: {},
        transcript: [],
      })
      .select('id')
      .single();

    if (dbError || !session) {
      console.error('[/api/sessions] Supabase insert error:', dbError);
      // Attempt to end the Tavus conversation to avoid orphaned rooms
      await fetch(`https://tavusapi.com/v2/conversations/${conversationId}/end`, {
        method: 'POST',
        headers: { 'x-api-key': process.env.TAVUS_API_KEY! },
      }).catch(() => {});
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({
      sessionId: session.id,
      conversationUrl,
    });
  } catch (err) {
    console.error('[/api/sessions] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
