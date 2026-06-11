/**
 * GET  /api/sessions/[id]  — fetch a single session
 * PATCH /api/sessions/[id] — update intake fields, transcript, consent, status
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const supabase = createServerSupabaseClient();

    // Only allow safe fields to be updated from client
    const allowedFields = [
      'status',
      'consent',
      'reason_for_visit',
      'symptom_description',
      'symptom_location',
      'pain_level',
      'symptom_duration',
      'symptom_triggers',
      'relevant_history',
      'medications_allergies',
      'additional_notes',
      'urgent_flag',
      'intake',
      'transcript',
    ] as const;

    type AllowedField = (typeof allowedFields)[number];
    const update: Partial<Record<AllowedField, unknown>> = {};

    for (const field of allowedFields) {
      if (field in body) {
        update[field] = body[field];
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('sessions')
      .update(update)
      .eq('id', id);

    if (error) {
      console.error('[PATCH /api/sessions/[id]] Supabase error:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/sessions/[id]] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
