/**
 * GET /api/admin/sessions
 *
 * Returns all sessions ordered by started_at desc.
 * Requires admin_session cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '@/lib/supabase-server';

function isAdminAuthenticated(): Promise<boolean> {
  return cookies().then((cookieStore) => {
    return cookieStore.get('admin_session')?.value === 'authenticated';
  });
}

export async function GET(_req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, patient_name, status, consent, reason_for_visit, started_at, ended_at, recording_path'
    )
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[GET /api/admin/sessions] Error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
