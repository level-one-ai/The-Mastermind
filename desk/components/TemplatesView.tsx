'use client';

import { useState } from 'react';
import { bookingRate, decided, emptyRow, MIN_DECIDED, pct, type Stats } from '@/lib/stats';
import { SECTION_LABEL, type Niche, type Template } from '@/lib/types';
import CopyButton from './CopyButton';
import ScriptText from './ScriptText';

const STATUS: Record<Template['status'], { label: string; cls: string }> = {
  champion: { label: 'Champion', cls: 'bg-status-good-tint text-status-good' },
  testing: { label: 'Testing', cls: 'bg-status-hold-tint text-status-hold' },
  active: { label: 'Active', cls: 'bg-canvas-deep text-ink' },
  retired: { label: 'Retired', cls: 'bg-canvas-deep text-faint' },
};

export default function TemplatesView({ niches, stats }: { niches: Niche[]; stats: Stats }) {
  const [nicheId, setNicheId] = useState(niches[0]?.id ?? '');
  const niche = niches.find((n) => n.id === nicheId);
  const [open, setOpen] = useState<string | null>(null);

  if (!niches.length)
    return <p className="mx-auto mt-10 max-w-md text-center text-sm text-muted">No templates yet. They live in library/niches in the repo.</p>;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6">
      <p className="max-w-2xl text-[0.95rem] leading-relaxed text-muted">
        Every script starts from one of these. The highlighted words are filled in for each business, so the scripts you call from have no blanks.
        The Mastermind keeps the template that books the most meetings and keeps testing a challenger against it.
      </p>

      <div role="tablist" aria-label="Niche" className="mt-5 flex flex-wrap gap-2">
        {niches.map((n) => (
          <button
            key={n.id}
            role="tab"
            aria-selected={n.id === nicheId}
            onClick={() => {
              setNicheId(n.id);
              setOpen(null);
            }}
            className={`rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors ${
              n.id === nicheId ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {n.label}
          </button>
        ))}
      </div>

      {niche && (
        <>
          <section className="mt-6 grid gap-x-8 gap-y-3 border-y border-line py-5 text-[0.9rem] sm:grid-cols-3">
            <div>
              <h2 className="label">Who</h2>
              <p className="mt-1">{niche.examples}</p>
            </div>
            <div>
              <h2 className="label">What hurts</h2>
              <p className="mt-1">{niche.pain}</p>
            </div>
            <div>
              <h2 className="label">Best time to ring</h2>
              <p className="mt-1">{niche.bestTime}</p>
            </div>
          </section>

          <div className="mt-6 space-y-4">
            {niche.templates.map((t) => {
              const row = stats.byTemplate[t.id] ?? emptyRow();
              const d = decided(row);
              const isOpen = open === t.id;
              const text = t.sections.map((s) => `${SECTION_LABEL[s.id].toUpperCase()}\n${s.body}`).join('\n\n');
              return (
                <article key={t.id} className="panel p-5 sm:p-6">
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-[1.6rem] leading-none tracking-tight">
                          {t.letter}. {t.name}
                        </h3>
                        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-medium ${STATUS[t.status].cls}`}>{STATUS[t.status].label}</span>
                      </div>
                      <p className="mt-2 max-w-2xl text-[0.9rem] text-muted">{t.why}</p>
                      <p className="mt-1 font-mono text-xs text-faint">{t.id}</p>
                    </div>
                    <div className="text-right">
                      {d ? (
                        <>
                          <p className="font-display text-[2.4rem] leading-none tabular-nums">{pct(bookingRate(row))}</p>
                          <p className="mt-1 text-xs text-muted">
                            {row.booked} booked · {row.lost} lost
                            <br />
                            {d < MIN_DECIDED ? `${MIN_DECIDED - d} more to judge it` : `${d} decided`}
                          </p>
                        </>
                      ) : (
                        <p className="pt-1 text-sm text-muted">{row.leads ? `${row.leads} being called` : 'Not used yet'}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                    <button type="button" className="btn btn-ghost" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.id)}>
                      {isOpen ? 'Hide the template' : 'Read the template'}
                    </button>
                    <CopyButton text={text} label="Copy" variant="quiet" />
                  </div>
                  {isOpen && (
                    <div className="mt-5 space-y-6">
                      {t.sections.map((s) => (
                        <div key={s.id} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6">
                          <h4 className="label pt-0.5">{SECTION_LABEL[s.id]}</h4>
                          <ScriptText body={s.body} />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <details className="mt-6 text-[0.875rem]">
            <summary className="cursor-pointer text-muted hover:text-ink">What each highlighted word gets filled with</summary>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[200px_minmax(0,1fr)]">
              {Object.entries(niche.variables).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-mono text-xs text-status-hold">{k}</dt>
                  <dd className="text-muted">{v}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </div>
  );
}
