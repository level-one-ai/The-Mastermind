'use client';

import { ArrowLeft, CalendarCheck, Check, ExternalLink, Pencil, Phone, PhoneMissed, RotateCcw, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { niceDate, niceStamp } from '@/lib/dates';
import {
  LOST_REASONS,
  OUTCOME_LABEL,
  OUTCOMES,
  PROFILE_FIELDS,
  PROFILE_LABEL,
  STAGES,
  type Lead,
  type LeadOp,
  type Outcome,
  type Profile,
  type ProfileField,
  type Section,
} from '@/lib/types';
import CopyButton from './CopyButton';
import ScriptText from './ScriptText';

type Run = (lead: Lead, op: LeadOp, done?: string) => Promise<boolean>;

const JUMP: Section['id'][] = ['opener', 'questions', 'ask', 'objections', 'voicemail'];
const NEEDS_FORM: Outcome[] = ['callback', 'lost', 'dnc'];

function tomorrowAt(today: string, hhmm: string) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T${hhmm}`;
}

export default function LeadPanel({
  lead,
  today,
  nicheLabel,
  templateName,
  onBack,
  run,
}: {
  lead: Lead;
  today: string;
  nicheLabel: string;
  templateName: string;
  onBack: () => void;
  run: Run;
}) {
  const sections = lead.script.sections;
  const fullScript = sections.map((s) => `${s.label.toUpperCase()}\n${s.body}`).join('\n\n');

  return (
    <article className="space-y-4">
      <button type="button" onClick={onBack} className="btn btn-quiet -ml-2 lg:hidden">
        <ArrowLeft size={15} aria-hidden /> All leads
      </button>

      <div className="panel p-5 sm:p-6">
        <ProfileHeader lead={lead} nicheLabel={nicheLabel} run={run} />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4 text-[0.8125rem] text-muted">
          <span>
            Script <span className="font-mono text-ink">{lead.script.id}</span> · {templateName}
            {lead.script.slot === 'challenger' ? ' · challenger' : ''}
          </span>
          <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-ink">
            <input
              type="checkbox"
              checked={!!lead.tps?.checked}
              onChange={(e) => run(lead, { op: 'tps', checked: e.target.checked }, e.target.checked ? 'TPS / CTPS ticked' : 'Unticked')}
              className="size-4 accent-[var(--color-ink)]"
            />
            TPS / CTPS checked
          </label>
        </div>
      </div>

      <OutcomeBar lead={lead} today={today} run={run} />

      <div className="flex flex-wrap items-center gap-2">
        {JUMP.map((id) => (
          <a key={id} href={`#s-${id}`} className="btn btn-ghost !min-h-8 !px-3 !text-xs">
            {sections.find((s) => s.id === id)?.label}
          </a>
        ))}
        <CopyButton text={fullScript} label="Copy whole script" variant="quiet" className="ml-auto" />
      </div>

      {sections.map((s) => (
        <ScriptSection key={s.id} lead={lead} section={s} run={run} />
      ))}

      {lead.signals?.length ? (
        <section className="panel p-5 sm:p-6">
          <h3 className="label">Why this business (research)</h3>
          <ul className="mt-3 space-y-2 text-[0.9rem]">
            {lead.signals.map((sig, i) => (
              <li key={i}>
                {sig.text}
                <span className="text-muted">
                  {' '}
                  · {sig.source}
                  {sig.date ? `, ${sig.date}` : ''}
                  {sig.confidence ? ` · ${sig.confidence}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Notes lead={lead} run={run} />
    </article>
  );
}

function OutcomeBar({ lead, today, run }: { lead: Lead; today: string; run: Run }) {
  const [picked, setPicked] = useState<Outcome | ''>('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [stage, setStage] = useState('');
  const [when, setWhen] = useState(tomorrowAt(today, '08:00'));
  const [busy, setBusy] = useState(false);
  const last = lead.calls[lead.calls.length - 1];

  const reset = () => {
    setPicked('');
    setNote('');
    setReason('');
    setStage('');
  };

  const log = async (outcome: Outcome) => {
    if (outcome === 'lost' && !reason) return;
    setBusy(true);
    const done =
      outcome === 'booked'
        ? 'Booked. Moved to Booked'
        : outcome === 'lost'
          ? 'Moved to Lost'
          : outcome === 'dnc' || outcome === 'wrong-number'
            ? `${OUTCOME_LABEL[outcome]}. Moved to Lost`
            : `${OUTCOME_LABEL[outcome]} logged`;
    const ok = await run(
      lead,
      { op: 'log', outcome, note, lostReason: reason || undefined, stage: stage || undefined, callbackAt: outcome === 'callback' ? when : undefined },
      done,
    );
    setBusy(false);
    if (ok) reset();
  };

  const choose = (o: Outcome) => {
    setPicked(o);
    if (!NEEDS_FORM.includes(o)) void log(o);
  };

  if (lead.status === 'lost' || lead.status === 'booked') {
    const lostLine =
      last?.outcome === 'lost' ? `Lost${last.lostReason ? ` · ${last.lostReason}` : ''}${last.stage ? ` · went wrong at ${last.stage.toLowerCase()}` : ''}` : last ? OUTCOME_LABEL[last.outcome] : '';
    return (
      <div
        className={`flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4 text-sm ${
          lead.status === 'booked' ? 'bg-status-good-tint text-status-good' : 'bg-status-alert-tint text-status-alert'
        }`}
      >
        <strong className="font-medium">{lead.status === 'booked' ? 'Meeting booked' : 'On the Lost list'}</strong>
        <span>{lead.status === 'lost' ? lostLine : last ? niceStamp(last.at) : ''}</span>
        {last?.note && <span className="text-ink/70">“{last.note}”</span>}
        <span className="ml-auto flex gap-2">
          {lead.status === 'lost' && (
            <button type="button" className="btn btn-ghost" onClick={() => run(lead, { op: 'restore' }, 'Back on the call list')}>
              <RotateCcw size={15} aria-hidden /> Bring back
            </button>
          )}
          {lead.status === 'booked' && (
            <button type="button" className="btn btn-ghost" onClick={() => run(lead, { op: 'undo' }, 'Undone')}>
              <Undo2 size={15} aria-hidden /> Undo
            </button>
          )}
        </span>
        {lead.status === 'lost' && last?.outcome === 'dnc' && (
          <p className="w-full text-xs">They asked not to be called. Only bring this back if they get in touch first.</p>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Log this call" className="panel z-10 p-4 sm:p-5 lg:sticky lg:top-[4.25rem]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1">How did it go?</span>
        <button type="button" disabled={busy} onClick={() => choose('booked')} className="btn btn-primary">
          <CalendarCheck size={15} aria-hidden /> Booked
        </button>
        <button type="button" disabled={busy} onClick={() => choose('callback')} className={`btn btn-ghost ${picked === 'callback' ? '!border-ink' : ''}`}>
          Callback
        </button>
        <button type="button" disabled={busy} onClick={() => choose('no-answer')} className="btn btn-ghost">
          <PhoneMissed size={15} aria-hidden /> No answer
        </button>
        <button type="button" disabled={busy} onClick={() => choose('lost')} className={`btn btn-ghost ${picked === 'lost' ? '!border-ink' : ''}`}>
          <X size={15} aria-hidden /> Lost
        </button>
        <label className="ml-auto">
          <span className="sr-only">Every outcome</span>
          <select
            value=""
            disabled={busy}
            onChange={(e) => e.target.value && choose(e.target.value as Outcome)}
            className="rounded-full border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">More outcomes…</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">Note</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional): who answered, what they said"
          className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2 text-sm outline-none focus:border-ink"
        />
      </label>

      {picked === 'callback' && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-canvas-deep p-3">
          <label className="text-sm">
            <span className="label block">Call back on</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 rounded-lg border border-line bg-surface px-3 py-1.5" />
          </label>
          <button type="button" disabled={busy} className="btn btn-primary" onClick={() => log('callback')}>
            Save callback
          </button>
          <button type="button" className="btn btn-quiet" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {(picked === 'lost' || picked === 'dnc') && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-canvas-deep p-3">
          {picked === 'lost' && (
            <label className="text-sm">
              <span className="label block">Why?</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 rounded-lg border border-line bg-surface px-3 py-1.5">
                <option value="">Pick one</option>
                {LOST_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            <span className="label block">Where did it go wrong?</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="mt-1 rounded-lg border border-line bg-surface px-3 py-1.5">
              <option value="">Not sure</option>
              {STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy || (picked === 'lost' && !reason)} className="btn btn-primary" onClick={() => log(picked)}>
            Move to Lost
          </button>
          <button type="button" className="btn btn-quiet" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {lead.calls.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-[0.8125rem] text-muted">
          <span>
            {lead.calls.length} {lead.calls.length === 1 ? 'call' : 'calls'}:
          </span>
          {lead.calls.map((c, i) => (
            <span key={i} title={c.note}>
              {OUTCOME_LABEL[c.outcome]} {niceDate(c.at.slice(0, 10), today).toLowerCase()}
              {c.note ? ' *' : ''}
            </span>
          ))}
          <button type="button" className="btn btn-quiet ml-auto !min-h-7" onClick={() => run(lead, { op: 'undo' }, 'Last call undone')}>
            <Undo2 size={14} aria-hidden /> Undo last
          </button>
        </div>
      )}
    </section>
  );
}

function ScriptSection({ lead, section: s, run }: { lead: Lead; section: Section; run: Run }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.body);
  const [saving, setSaving] = useState(false);
  const big = s.id === 'opener' || s.id === 'reason' || s.id === 'ask';
  const quiet = s.id === 'prep';

  return (
    <section id={`s-${s.id}`} className={`scroll-mt-48 ${quiet ? 'rounded-[1.25rem] border border-dashed border-line-strong p-5 sm:p-6' : 'panel p-5 sm:p-6'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={`${big ? 'text-[0.95rem] font-semibold' : 'label'}`}>{s.label}</h3>
        {s.edited && <span className="rounded-full bg-status-good-tint px-2 py-0.5 text-[0.6875rem] font-medium text-status-good">Your edit</span>}
        <span className="ml-auto flex gap-1">
          {!editing && (
            <>
              <CopyButton text={s.body} label="Copy" variant="quiet" />
              <button
                type="button"
                className="btn btn-quiet"
                onClick={() => {
                  setDraft(s.body);
                  setEditing(true);
                }}
              >
                <Pencil size={14} aria-hidden /> Edit
              </button>
            </>
          )}
        </span>
      </div>

      <div className="mt-3">
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={Math.min(18, Math.max(4, draft.split('\n').length + 1))}
              className="w-full rounded-xl border border-line bg-canvas px-4 py-3 font-sans text-[0.95rem] leading-relaxed outline-none focus:border-ink"
              aria-label={`Edit ${s.label}`}
            />
            <p className="mt-1.5 text-xs text-faint">Write it how you&apos;d say it. The Mastermind learns your voice from every saved edit.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  const ok = await run(lead, { op: 'edit', sectionId: s.id, body: draft }, 'Edit saved');
                  setSaving(false);
                  if (ok) setEditing(false);
                }}
              >
                <Check size={15} aria-hidden /> Save my edit
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>
                Cancel
              </button>
              {s.edited && (
                <button
                  type="button"
                  className="btn btn-quiet ml-auto"
                  onClick={async () => {
                    if (await run(lead, { op: 'revert', sectionId: s.id }, 'Back to the original')) setEditing(false);
                  }}
                >
                  Use the original
                </button>
              )}
            </div>
          </>
        ) : (
          <div className={quiet ? 'text-muted' : ''}>
            <ScriptText body={s.body} large={big} />
          </div>
        )}
      </div>
    </section>
  );
}

function Notes({ lead, run }: { lead: Lead; run: Run }) {
  const [text, setText] = useState(lead.notes ?? '');
  const dirty = text !== (lead.notes ?? '');
  return (
    <section className="panel p-5 sm:p-6">
      <label htmlFor="notes" className="label">
        Notes about this business
      </label>
      <textarea
        id="notes"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Anything worth knowing next time: the gatekeeper's name, when they're quiet, what they use now"
        className="mt-2 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-[0.925rem] outline-none focus:border-ink"
      />
      {dirty && (
        <button type="button" className="btn btn-ghost mt-2" onClick={() => run(lead, { op: 'notes', notes: text }, 'Notes saved')}>
          Save notes
        </button>
      )}
    </section>
  );
}

const hasPhone = (p: string) => /^[+\d][\d\s()+-]{6,}$/.test(p.trim());

function ProfileHeader({ lead, nicheLabel, run }: { lead: Lead; nicheLabel: string; run: Run }) {
  const current = (): Profile =>
    Object.fromEntries(PROFILE_FIELDS.map((f) => [f, String((lead as unknown as Record<string, string | undefined>)[f] ?? '')])) as Profile;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(current);
  const [saving, setSaving] = useState(false);

  const open = () => {
    setDraft(current());
    setEditing(true);
  };

  if (editing) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          const ok = await run(lead, { op: 'profile', profile: draft }, 'Details saved');
          setSaving(false);
          if (ok) setEditing(false);
        }}
      >
        <h2 className="label">Edit company details</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PROFILE_FIELDS.map((f: ProfileField) => (
            <label key={f} className={`text-sm ${f === 'bestTime' ? 'sm:col-span-2' : ''}`}>
              <span className="text-muted">{PROFILE_LABEL[f]}</span>
              <input
                value={draft[f]}
                onChange={(e) => setDraft((d) => ({ ...d, [f]: e.target.value }))}
                type={f === 'phone' ? 'tel' : f === 'email' ? 'email' : 'text'}
                inputMode={f === 'phone' ? 'tel' : undefined}
                autoFocus={f === 'phone' && !hasPhone(lead.phone)}
                placeholder={f === 'phone' ? 'e.g. 07700 900123' : ''}
                className="mt-1 w-full rounded-xl border border-line bg-canvas px-3.5 py-2 text-[0.925rem] outline-none focus:border-ink"
              />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">Changing details here doesn&apos;t rewrite the script. Edit the script sections below if a name or town in them needs changing.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            <Check size={15} aria-hidden /> Save details
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] text-muted">
          {nicheLabel}
          {lead.town ? ` · ${lead.town}` : ''}
          {lead.demo ? ' · demo' : ''}
        </p>
        <h2 className="mt-1 font-display text-[2.1rem] leading-[1.05] tracking-tight">{lead.company}</h2>
        <p className="mt-1.5 text-[0.95rem]">
          {[lead.contact, lead.role].filter(Boolean).join(', ') || 'Owner name not public'}
          {lead.bestTime ? <span className="text-muted"> · best time: {lead.bestTime}</span> : null}
        </p>
        {(lead.email || lead.instagram) && (
          <p className="mt-1 text-[0.8125rem] text-muted">{[lead.email, lead.instagram].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {hasPhone(lead.phone) ? (
          <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`} className="btn btn-primary">
            <Phone size={15} aria-hidden /> {lead.phone}
          </a>
        ) : (
          <button type="button" onClick={open} className="btn btn-ghost !border-status-hold/40 text-status-hold">
            <Phone size={15} aria-hidden /> Add phone number
          </button>
        )}
        {lead.website && (
          <a href={lead.website} target="_blank" rel="noreferrer" className="btn btn-ghost">
            <ExternalLink size={15} aria-hidden /> Website
          </a>
        )}
        <button type="button" onClick={open} className="btn btn-quiet">
          <Pencil size={14} aria-hidden /> Edit details
        </button>
      </div>
    </div>
  );
}
