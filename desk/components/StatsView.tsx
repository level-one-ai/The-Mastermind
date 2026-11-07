'use client';

import { bookingRate, decided, MIN_DECIDED, pct, type Row, type Stats } from '@/lib/stats';
import { PATTERN_LABEL, type Niche } from '@/lib/types';

function RateBar({ row }: { row: Row }) {
  const r = bookingRate(row);
  const d = decided(row);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-full min-w-16 overflow-hidden rounded-full bg-canvas-deep" aria-hidden>
        {r !== null && <div className={`h-full rounded-full ${d < MIN_DECIDED ? 'bg-line-strong' : 'bg-ink'}`} style={{ width: `${Math.max(2, r * 100)}%` }} />}
      </div>
      <span className="w-11 shrink-0 text-right font-medium tabular-nums">{pct(r)}</span>
    </div>
  );
}

function Table({ title, rows, label, extra }: { title: string; rows: [string, Row][]; label: (k: string) => string; extra?: (k: string) => string }) {
  return (
    <section className="panel overflow-hidden">
      <h2 className="px-5 pt-5 text-[0.95rem] font-semibold sm:px-6">{title}</h2>
      {!rows.length ? (
        <p className="px-5 pb-5 pt-2 text-sm text-muted sm:px-6">Nothing logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-3 w-full min-w-[560px] text-[0.875rem]">
            <thead>
              <tr className="border-y border-line text-left text-xs text-muted">
                <th className="px-5 py-2 font-medium sm:px-6">Name</th>
                <th className="px-3 py-2 text-right font-medium">Calls</th>
                <th className="px-3 py-2 text-right font-medium">Booked</th>
                <th className="px-3 py-2 text-right font-medium">Lost</th>
                <th className="w-[34%] px-5 py-2 font-medium sm:px-6">Booking rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, r]) => {
                const d = decided(r);
                return (
                  <tr key={k} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3 sm:px-6">
                      <span className="font-medium">{label(k)}</span>
                      <span className="block text-xs text-muted">
                        {extra ? `${extra(k)} · ` : ''}
                        {d < MIN_DECIDED ? `too early, ${MIN_DECIDED - d} more to judge` : `${d} decided`}
                        {r.open ? ` · ${r.open} still being called` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.calls}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.booked}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.lost}</td>
                    <td className="px-5 py-3 sm:px-6">
                      <RateBar row={r} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tally({ title, items, empty }: { title: string; items: [string, number][]; empty: string }) {
  const max = Math.max(1, ...items.map(([, n]) => n));
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="text-[0.95rem] font-semibold">{title}</h2>
      {!items.length ? (
        <p className="mt-2 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2.5 text-[0.875rem]">
          {items.map(([k, n]) => (
            <li key={k} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-3">
              <span className="truncate">{k}</span>
              <span className="h-2 overflow-hidden rounded-full bg-canvas-deep" aria-hidden>
                <span className="block h-full rounded-full bg-status-alert/70" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function StatsView({
  stats,
  niches,
  templateName,
  nicheLabel,
}: {
  stats: Stats;
  niches: Niche[];
  templateName: (id: string) => string;
  nicheLabel: (id: string) => string;
}) {
  const t = stats.total;
  const byRate = (a: [string, Row], b: [string, Row]) => (bookingRate(b[1]) ?? -1) - (bookingRate(a[1]) ?? -1) || b[1].leads - a[1].leads;
  const templateNiche = (id: string) => niches.find((n) => n.templates.some((x) => x.id === id))?.label ?? '';

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 px-4 py-6 sm:px-6">
      <section className="flex flex-wrap items-end gap-x-10 gap-y-4 border-b border-line pb-6">
        <div>
          <p className="label">Booking rate, every script</p>
          <p className="mt-1 font-display text-[4rem] leading-none tabular-nums">{pct(bookingRate(t))}</p>
        </div>
        <p className="max-w-xl pb-1 text-[0.95rem] leading-relaxed text-muted">
          <strong className="font-semibold text-ink">{t.booked} booked</strong> and <strong className="font-semibold text-ink">{t.lost} lost</strong> from{' '}
          {t.calls} {t.calls === 1 ? 'call' : 'calls'} to {t.leads} {t.leads === 1 ? 'business' : 'businesses'}
          {t.bad ? `, plus ${t.bad} wrong ${t.bad === 1 ? 'number' : 'numbers'} that don't count against a script` : ''}. Booking rate is booked ÷ (booked + lost).
          A script needs {MIN_DECIDED} booked-or-lost leads before the number means much.
        </p>
      </section>

      <Table
        title="By script template"
        rows={Object.entries(stats.byTemplate).sort(byRate)}
        label={templateName}
        extra={templateNiche}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Tally title="Why leads were lost" items={stats.lostReasons} empty="No losses logged yet." />
        <Tally title="Where calls went wrong" items={stats.stages} empty="Pick “Where did it go wrong?” when you log a loss and it shows here." />
      </div>
      <Table title="By niche" rows={Object.entries(stats.byNiche).sort(byRate)} label={nicheLabel} />
      <Table title="By opener" rows={Object.entries(stats.byPattern).sort(byRate)} label={(k) => PATTERN_LABEL[k] ?? k} />
    </div>
  );
}
