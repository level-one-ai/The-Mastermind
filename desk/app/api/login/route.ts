import { NextResponse } from 'next/server';
import { COOKIE, passwordMatches, sessionValue } from '@/lib/auth';

export async function POST(req: Request) {
  const form = await req.formData();
  const ok = passwordMatches(String(form.get('password') ?? ''));
  const url = new URL(ok ? '/' : '/login?wrong=1', req.url);
  const res = NextResponse.redirect(url, 303);
  if (ok) {
    res.cookies.set(COOKIE, sessionValue(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return res;
}
