import { CONVERSATION_OUTCOMES, LOST_OUTCOMES, type Lead } from './types';

/**
 * Same definitions as skill/the-mastermind/scripts/mastermind.py, so the desk and the skill agree.
 * Booking rate = booked / (booked + lost). Wrong numbers aren't the script's fault, so they don't count as lost.
 */
export const MIN_DECIDED = 10;

export interface Row {
  leads: number;
  calls: number;
  conversations: number;
  booked: number;
  lost: number;
  bad: number;
  open: number;
}

export const emptyRow = (): Row => ({ leads: 0, calls: 0, conversations: 0, booked: 0, lost: 0, bad: 0, open: 0 });
export const decided = (r: Row) => r.booked + r.lost;
export const bookingRate = (r: Row): number | null => (decided(r) ? r.booked / decided(r) : null);
export const pct = (n: number | null) => (n === null ? '-' : `${Math.round(n * 100)}%`);

export type FinalState = 'booked' | 'lost' | 'bad' | 'open';

export function finalState(lead: Lead): FinalState {
  if (lead.status === 'booked') return 'booked';
  if (lead.status === 'lost') {
    const last = [...lead.calls].reverse().find((c) => LOST_OUTCOMES.includes(c.outcome));
    return last?.outcome === 'wrong-number' ? 'bad' : 'lost';
  }
  return 'open';
}

function add(row: Row, lead: Lead, state: FinalState) {
  row.leads += 1;
  row.calls += lead.calls.length;
  row.conversations += lead.calls.filter((c) => CONVERSATION_OUTCOMES.includes(c.outcome)).length;
  row[state] += 1;
}

export interface Stats {
  total: Row;
  byTemplate: Record<string, Row>;
  byNiche: Record<string, Row>;
  byPattern: Record<string, Row>;
  lostReasons: [string, number][];
  stages: [string, number][];
}

export function computeStats(leads: Lead[]): Stats {
  const total = emptyRow();
  const byTemplate: Record<string, Row> = {};
  const byNiche: Record<string, Row> = {};
  const byPattern: Record<string, Row> = {};
  const reasons = new Map<string, number>();
  const stages = new Map<string, number>();
  for (const lead of leads) {
    if (lead.demo) continue;
    const state = finalState(lead);
    add(total, lead, state);
    add((byTemplate[lead.script.templateId] ??= emptyRow()), lead, state);
    add((byNiche[lead.niche] ??= emptyRow()), lead, state);
    add((byPattern[lead.script.pattern || 'unknown'] ??= emptyRow()), lead, state);
    if (state === 'lost') {
      const last = [...lead.calls].reverse().find((c) => LOST_OUTCOMES.includes(c.outcome));
      const reason = last?.outcome === 'dnc' ? 'Asked not to call' : last?.lostReason || 'No reason given';
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      if (last?.stage) stages.set(last.stage, (stages.get(last.stage) ?? 0) + 1);
    }
  }
  const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return { total, byTemplate, byNiche, byPattern, lostReasons: sorted(reasons), stages: sorted(stages) };
}
