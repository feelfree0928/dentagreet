/**
 * POST /api/admin/login
 *
 * Prototype-grade admin authentication.
 * Checks password against ADMIN_PASSWORD env var.
 * Sets an httpOnly cookie on success.
 *
 * NOTE: This is NOT production auth. See README → Production Roadmap.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_session';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password: string = body.password ?? '';

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('[Admin Login] ADMIN_PASSWORD env var not set');
      return NextResponse.json({ error: 'Admin not configured' }, { status: 500 });
    }

    if (password !== adminPassword) {
      // Constant-time comparison would be better in production
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Set httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Admin Login] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
