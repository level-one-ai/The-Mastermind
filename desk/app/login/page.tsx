import { redirect } from 'next/navigation';
import { isSignedIn } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<{ wrong?: string }> }) {
  if (await isSignedIn()) redirect('/');
  const { wrong } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <form action="/api/login" method="post" className="panel w-full max-w-sm p-7">
        <h1 className="font-display text-4xl leading-none tracking-tight">Call Desk</h1>
        <p className="mt-2 text-sm text-muted">Level One. Type your password to open it.</p>
        <label htmlFor="password" className="label mt-7 block">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
          className="mt-1.5 w-full rounded-xl border border-line bg-canvas px-4 py-2.5 text-[0.95rem] outline-none transition-colors focus:border-ink"
        />
        {wrong && (
          <p role="alert" className="mt-2 text-sm text-status-alert">
            That password didn&apos;t match. Try again.
          </p>
        )}
        <button className="btn btn-primary mt-6 w-full">Open the desk</button>
      </form>
    </main>
  );
}
