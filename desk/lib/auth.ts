import { createHash, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const COOKIE = 'mm_desk';

function token(password: string) {
  return createHash('sha256').update(`the-mastermind-desk:${password}`).digest('hex');
}

export function passwordMatches(input: string) {
  const real = process.env.DESK_PASSWORD ?? '';
  if (!real) return false;
  const a = Buffer.from(token(input));
  const b = Buffer.from(token(real));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionValue() {
  return token(process.env.DESK_PASSWORD ?? '');
}

export async function isSignedIn() {
  if (!process.env.DESK_PASSWORD) return process.env.NODE_ENV !== 'production';
  const jar = await cookies();
  return jar.get(COOKIE)?.value === sessionValue();
}
