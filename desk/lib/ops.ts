import { nowISO } from './dates';
import { LOST_OUTCOMES, OUTCOME_LABEL, type Lead, type LeadOp, type Status } from './types';

export interface OpResult {
  lead: Lead;
  edit?: { name: string; data: unknown };
  summary: string;
}

/** Where a lead sits after its latest logged call. */
export function statusAfter(lead: Lead): { status: Status; callbackAt?: string } {
  const last = lead.calls[lead.calls.length - 1];
  if (!last) return { status: 'to-call' };
  if (last.outcome === 'booked') return { status: 'booked' };
  if (LOST_OUTCOMES.includes(last.outcome)) return { status: 'lost' };
  if (last.outcome === 'callback' && last.callbackAt) return { status: 'callback', callbackAt: last.callbackAt };
  return { status: 'to-call' };
}

export function applyOp(input: Lead, op: LeadOp): OpResult {
  const lead: Lead = structuredClone(input);
  const at = nowISO();
  const who = lead.company;
  lead.updatedAt = at;

  const section = (id: string) => {
    const s = lead.script.sections.find((x) => x.id === id);
    if (!s) throw new Error('That part of the script was not found');
    return s;
  };

  switch (op.op) {
    case 'log': {
      if (!OUTCOME_LABEL[op.outcome]) throw new Error('Pick how the call went');
      if (op.outcome === 'callback' && !op.callbackAt) throw new Error('Pick a day and time for the callback');
      const call = {
        at,
        outcome: op.outcome,
        ...(op.note?.trim() ? { note: op.note.trim() } : {}),
        ...(op.outcome === 'lost' && op.lostReason ? { lostReason: op.lostReason } : {}),
        ...((op.outcome === 'lost' || op.outcome === 'dnc') && op.stage ? { stage: op.stage } : {}),
        ...(op.outcome === 'callback' ? { callbackAt: op.callbackAt } : {}),
      };
      lead.calls.push(call);
      const next = statusAfter(lead);
      lead.status = next.status;
      lead.callbackAt = next.callbackAt;
      return { lead, summary: `${who}: ${OUTCOME_LABEL[op.outcome].toLowerCase()}` };
    }
    case 'undo': {
      if (!lead.calls.length) throw new Error('No call to undo');
      const gone = lead.calls.pop()!;
      const next = statusAfter(lead);
      lead.status = next.status;
      lead.callbackAt = next.callbackAt;
      return { lead, summary: `${who}: undid ${OUTCOME_LABEL[gone.outcome].toLowerCase()}` };
    }
    case 'restore': {
      if (lead.status !== 'lost') throw new Error('This lead is not on the Lost list');
      // Bringing a lead back undoes the losing call, so it no longer counts against the script.
      const i = [...lead.calls].reverse().findIndex((c) => LOST_OUTCOMES.includes(c.outcome));
      if (i >= 0) lead.calls.splice(lead.calls.length - 1 - i, 1);
      const next = statusAfter(lead);
      lead.status = next.status === 'lost' ? 'to-call' : next.status;
      lead.callbackAt = next.callbackAt;
      return { lead, summary: `${who}: back on the call list` };
    }
    case 'edit': {
      const s = section(op.sectionId);
      const before = s.body;
      s.body = op.body.replace(/\r\n/g, '\n').trimEnd();
      s.edited = s.body !== s.original;
      s.editedAt = at;
      if (before === s.body) return { lead, summary: `${who}: no change` };
      return {
        lead,
        summary: `${who}: edited ${s.label.toLowerCase()}`,
        edit: {
          name: `${at.replace(/[:.]/g, '-')}-${lead.id}-${s.id}`,
          data: {
            savedAt: at,
            leadId: lead.id,
            company: lead.company,
            niche: lead.niche,
            templateId: lead.script.templateId,
            section: s.id,
            label: s.label,
            original: s.original,
            before,
            edited: s.body,
          },
        },
      };
    }
    case 'revert': {
      const s = section(op.sectionId);
      s.body = s.original;
      s.edited = false;
      return { lead, summary: `${who}: back to the original ${s.label.toLowerCase()}` };
    }
    case 'tps': {
      lead.tps = op.checked ? { checked: true, checkedAt: at } : { checked: false };
      return { lead, summary: `${who}: TPS/CTPS ${op.checked ? 'checked' : 'unticked'}` };
    }
    case 'notes': {
      lead.notes = op.notes;
      return { lead, summary: `${who}: notes` };
    }
  }
}
