import { redirect } from 'next/navigation';
import Desk from '@/components/Desk';
import { isSignedIn } from '@/lib/auth';
import { todayUK } from '@/lib/dates';
import { listLeads, listNiches, storageLabel } from '@/lib/store';
import type { Lead, Niche } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!(await isSignedIn())) redirect('/login');
  let error: string | null = null;
  let leads: Lead[] = [];
  let niches: Niche[] = [];
  try {
    [leads, niches] = await Promise.all([listLeads(), listNiches()]);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Could not load your leads.';
  }
  // The demo lead only shows until the first real lead arrives.
  if (leads.some((l) => !l.demo)) leads = leads.filter((l) => !l.demo);
  return <Desk leads={leads} niches={niches} today={todayUK()} storage={storageLabel()} loadError={error} />;
}
