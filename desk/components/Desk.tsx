'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { niceDate } from '@/lib/dates';
import { computeStats } from '@/lib/stats';
import { OUTCOME_LABEL, type Lead, type LeadOp, type Niche } from '@/lib/types';
import LeadPanel from './LeadPanel';
import StatsView from './StatsView';
import TemplatesView from './TemplatesView';

type View = 'call' | 'booked' | 'lost' | 'templates' | 'stats';

const VIEWS: { id: View; label: string }[] = [
  { id: 'call', label: 'To call' },
  { id: 'booked', label: 'Booked' },
  { id: 'lost', label: 'Lost' },
  { id: 'templates', label: 'Templates' },
  { id: 'stats', label: 'Stats' },
];

interface Group {
  key: string;
  title: string;
  hint?: string;
  leads: Lead[];
}

const lastCall = (l: Lead) => l.calls[l.calls.length - 1];

function buildGroups(leads: Lead[], view: View, today: string, nicheLabel: (id: string) => string): Group[] {
  if (view === 'booked') {
    const rows = leads.filter((l) => l.status === 'booked').sort((a, b) => (lastCall(b)?.at ?? '').localeCompare(lastCall(a)?.at ?? ''));
    return rows.length ? [{ key: 'booked', title: 'Meetings booked', leads: rows }] : [];
  }
  if (view === 'lost') {
    const rows = leads.filter((l) => l.status === 'lost').sort((a, b) => (lastCall(b)?.at ?? '').localeCompare(lastCall(a)?.at ?? ''));
    return rows.length ? [{ key: 'lost', title: 'Lost', hint: 'Bring one back from its page', leads: rows }] : [];
  }
  const groups: Group[] = [];
  const callbacks = leads.filter((l) => l.status === 'callback').sort((a, b) => (a.callbackAt ?? '').localeCompare(b.callbackAt ?? ''));
  const due = callbacks.filter((l) => (l.callbackAt ?? '').slice(0, 10) <= today);
  const later = callbacks.filter((l) => (l.callbackAt ?? '').slice(0, 10) > today);
  if (due.length) groups.push({ key: 'due', title: 'Callbacks due', hint: 'You said you would', leads: due });
  const open = leads.filter((l) => l.status === 'to-call');
  // Fresh leads first, then ones you've tried, so nobody gets rung five times before others get rung once.
  const byNiche = new Map<string, Lead[]>();
  for (const l of open) byNiche.set(l.niche, [...(byNiche.get(l.niche) ?? []), l]);
  for (const [niche, rows] of [...byNiche.entries()].sort((a, b) => nicheLabel(a[0]).localeCompare(nicheLabel(b[0])))) {
    rows.sort((a, b) => a.calls.length - b.calls.length || a.createdAt.localeCompare(b.createdAt));
    groups.push({ key: `n-${niche}`, title: nicheLabel(niche), leads: rows });
  }
  if (later.length) groups.push({ key: 'later', title: 'Callbacks coming up', leads: later });
  return groups;
}

function rowMeta(l: Lead, today: string) {
  const last = lastCall(l);
  if (l.status === 'callback' && l.callbackAt) {
    const time = l.callbackAt.slice(11, 16);
    return `Call back ${niceDate(l.callbackAt.slice(0, 10), today).toLowerCase()}${time ? ` at ${time}` : ''}`;
  }
  if (l.status === 'lost' && last) {
    if (last.outcome === 'lost') return last.lostReason ? `Lost · ${last.lostReason}` : 'Lost';
    return OUTCOME_LABEL[last.outcome];
  }
  if (l.status === 'booked' && last) return `Booked ${niceDate(last.at.slice(0, 10), today).toLowerCase()}`;
  if (!last) return 'Not called yet';
  return `${OUTCOME_LABEL[last.outcome]} · ${l.calls.length} ${l.calls.length === 1 ? 'try' : 'tries'}`;
}

export default function Desk({
  leads: initial,
  niches,
  today,
  storage,
  loadError,
}: {
  leads: Lead[];
  niches: Niche[];
  today: string;
  storage: string;
  loadError: string | null;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initial);
  const [view, setView] = useState<View>('call');
  const [niche, setNiche] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'error' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => setLeads(initial), [initial]);

  const nicheLabel = useCallback((id: string) => niches.find((n) => n.id === id)?.label ?? id, [niches]);
  const templateName = useCallback(
    (id: string) => {
      for (const n of niches) {
        const t = n.templates.find((x) => x.id === id);
        if (t) return `${t.letter}: ${t.name}`;
      }
      return id;
    },
    [niches],
  );

  const filtered = useMemo(() => leads.filter((l) => niche === 'all' || l.niche === niche), [leads, niche]);
  const isList = view === 'call' || view === 'booked' || view === 'lost';
  const groups = useMemo(() => (isList ? buildGroups(filtered, view, today, nicheLabel) : []), [filtered, view, today, nicheLabel, isList]);
  const flat = useMemo(() => groups.flatMap((g) => g.leads), [groups]);
  const selected = leads.find((l) => l.id === selectedId) ?? null;
  const stats = useMemo(() => computeStats(leads), [leads]);

  // Open the first lead on wide screens.
  useEffect(() => {
    if (!isList) return;
    if (selectedId && flat.some((l) => l.id === selectedId)) return;
    if (window.matchMedia('(min-width: 1024px)').matches) setSelectedId(flat[0]?.id ?? null);
  }, [flat, selectedId, isList]);

  // j / k to move through the list when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]')) return;
      if (!isList || (e.key !== 'j' && e.key !== 'k')) return;
      const i = flat.findIndex((l) => l.id === selectedId);
      const next = flat[Math.min(flat.length - 1, Math.max(0, i + (e.key === 'j' ? 1 : -1)))];
      if (next) setSelectedId(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flat, selectedId, isList]);

  const flash = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), tone === 'error' ? 6000 : 2600);
  }, []);

  const run = useCallback(
    async (lead: Lead, op: LeadOp, done = 'Saved'): Promise<boolean> => {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, op }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        router.push('/login');
        return false;
      }
      if (!res.ok) {
        flash(data.error ?? 'Could not save. Try again.', 'error');
        return false;
      }
      setLeads((ls) => ls.map((l) => (l.id === lead.id ? (data.lead as Lead) : l)));
      flash(done);
      return true;
    },
    [flash, router],
  );

  const counts = {
    due: leads.filter((l) => l.status === 'callback' && (l.callbackAt ?? '').slice(0, 10) <= today).length,
    open: leads.filter((l) => l.status === 'to-call').length,
    booked: leads.filter((l) => l.status === 'booked').length,
    lost: leads.filter((l) => l.status === 'lost').length,
  };
  const leadNiches = niches.filter((n) => leads.some((l) => l.niche === n.id));

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#script" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 btn btn-primary">
        Skip to the script
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-[1.7rem] leading-none tracking-tight">Call Desk</h1>
            <span className="hidden text-sm text-muted sm:inline">The Mastermind · Level One</span>
          </div>
          <nav role="tablist" aria-label="View" className="order-3 flex w-full overflow-x-auto rounded-full border border-line bg-surface p-0.5 sm:order-none sm:ml-4 sm:w-auto">
            {VIEWS.map((v) => {
              const n = v.id === 'call' ? counts.open + counts.due : v.id === 'booked' ? counts.booked : v.id === 'lost' ? counts.lost : null;
              return (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  onClick={() => {
                    setView(v.id);
                    setSelectedId(null);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3.5 text-[0.8125rem] font-medium transition-colors ${
                    view === v.id ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'
                  }`}
                >
                  {v.label}
                  {n ? <span className={`tabular-nums ${view === v.id ? 'text-canvas/70' : 'text-faint'}`}>{n}</span> : null}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            className="btn btn-quiet ml-auto"
            onClick={() => {
              setRefreshing(true);
              router.refresh();
              window.setTimeout(() => setRefreshing(false), 900);
            }}
            title="Load new scripts from The Mastermind"
          >
            <RefreshCw size={15} aria-hidden className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Check for new scripts</span>
          </button>
        </div>
      </header>

      {loadError && (
        <div role="alert" className="mx-auto mt-4 w-full max-w-[1500px] px-4 sm:px-6">
          <div className="rounded-2xl border border-status-alert/20 bg-status-alert-tint px-5 py-4 text-sm text-status-alert">
            <strong className="font-medium">Couldn&apos;t load your leads.</strong> Nothing is lost; everything is still in your
            The-Mastermind repo. Check the GitHub key in Vercel, then refresh. ({loadError})
          </div>
        </div>
      )}

      {view === 'templates' && <TemplatesView niches={niches} stats={stats} />}
      {view === 'stats' && <StatsView stats={stats} niches={niches} templateName={templateName} nicheLabel={nicheLabel} />}

      {isList && (
        <div className="mx-auto grid w-full max-w-[1500px] flex-1 grid-cols-[minmax(0,1fr)] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <aside className={`${selected ? 'hidden lg:block' : ''} min-w-0 lg:sticky lg:top-[4.5rem] lg:h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:pr-1`}>
            <p className="text-[0.95rem] leading-relaxed">
              {view === 'call' && (
                <>
                  {counts.due ? (
                    <>
                      <strong className="font-semibold">{counts.due}</strong> {counts.due === 1 ? 'callback' : 'callbacks'} due and{' '}
                    </>
                  ) : null}
                  <strong className="font-semibold">{counts.open}</strong> {counts.open === 1 ? 'business' : 'businesses'} to ring.
                </>
              )}
              {view === 'booked' && (
                <>
                  <strong className="font-semibold">{counts.booked}</strong> {counts.booked === 1 ? 'meeting' : 'meetings'} booked so far.
                </>
              )}
              {view === 'lost' && (
                <>
                  <strong className="font-semibold">{counts.lost}</strong> lost. Each one tells The Mastermind what to change.
                </>
              )}
            </p>

            {leadNiches.length > 1 && (
              <label className="mt-4 block">
                <span className="sr-only">Niche</span>
                <select value={niche} onChange={(e) => setNiche(e.target.value)} className="w-full rounded-full border border-line bg-surface px-3.5 py-2 text-sm">
                  <option value="all">Every niche</option>
                  {leadNiches.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!groups.length ? (
              <EmptyList view={view} hasLeads={leads.length > 0} />
            ) : (
              <nav aria-label="Leads" className="mt-5 space-y-6">
                {groups.map((g) => (
                  <section key={g.key}>
                    <h2 className="flex items-baseline gap-2 px-1 text-[0.8125rem] font-medium">
                      {g.title}
                      <span className="text-faint tabular-nums">{g.leads.length}</span>
                      {g.hint && <span className="ml-auto text-xs font-normal text-faint">{g.hint}</span>}
                    </h2>
                    <ul className="mt-2 overflow-hidden rounded-2xl border border-line bg-surface">
                      {g.leads.map((l) => {
                        const active = l.id === selectedId;
                        return (
                          <li key={l.id} className="border-b border-line last:border-b-0">
                            <button
                              type="button"
                              onClick={() => setSelectedId(l.id)}
                              aria-current={active ? 'true' : undefined}
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-row-selected' : 'hover:bg-row-hover'}`}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[0.925rem] font-medium">{l.company}</span>
                                <span className="mt-0.5 block truncate text-[0.8125rem] text-muted">
                                  {[l.town, rowMeta(l, today)].filter(Boolean).join(' · ')}
                                </span>
                              </span>
                              {!/\d{6,}/.test(l.phone.replace(/\s/g, '')) && view === 'call' && (
                                <span className="mt-0.5 shrink-0 rounded-full bg-canvas-deep px-2 py-0.5 text-[0.6875rem] font-medium text-muted" title="No phone number yet">
                                  No number
                                </span>
                              )}
                              {view === 'call' && !l.tps?.checked && (
                                <span className="mt-0.5 shrink-0 rounded-full bg-status-hold-tint px-2 py-0.5 text-[0.6875rem] font-medium text-status-hold" title="Not checked against TPS / CTPS yet">
                                  TPS
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </nav>
            )}
            <p className="mt-6 px-1 text-xs text-faint">
              Saved to {storage}. Press j and k to move through the list.
            </p>
          </aside>

          <main id="script" className={`${selected ? '' : 'hidden lg:block'} min-w-0`}>
            {selected ? (
              <LeadPanel
                key={selected.id}
                lead={selected}
                today={today}
                nicheLabel={nicheLabel(selected.niche)}
                templateName={templateName(selected.script.templateId)}
                onBack={() => setSelectedId(null)}
                run={run}
              />
            ) : (
              <div className="panel grid min-h-[50vh] place-items-center p-8 text-center text-sm text-muted">Pick a business on the left to see its script.</div>
            )}
          </main>
        </div>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
        {toast && (
          <div
            className={`pointer-events-auto rounded-full px-4 py-2 text-sm shadow-lift ${
              toast.tone === 'ok' ? 'bg-ink text-canvas' : 'bg-status-alert-tint text-status-alert'
            }`}
          >
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyList({ view, hasLeads }: { view: View; hasLeads: boolean }) {
  const text =
    view === 'booked'
      ? 'No meetings booked yet. They land here the moment you log one.'
      : view === 'lost'
        ? 'Nothing lost. Leads you mark as Lost, Do not call or Wrong number move here.'
        : hasLeads
          ? 'Everyone has been rung. Ask The Mastermind for more businesses to call.'
          : 'No scripts yet. Ask The Mastermind to write scripts for some businesses, then press Check for new scripts.';
  return <p className="mt-6 rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-sm text-muted">{text}</p>;
}
