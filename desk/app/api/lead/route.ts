import { NextResponse } from 'next/server';
import { isSignedIn } from '@/lib/auth';
import { applyOp } from '@/lib/ops';
import { ConflictError, readLead, writeEdit, writeLead } from '@/lib/store';
import type { LeadOp } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!(await isSignedIn())) return NextResponse.json({ error: 'Signed out' }, { status: 401 });
  const { leadId, op } = (await req.json()) as { leadId: string; op: LeadOp };

  // Read, change, write. If The Mastermind pushed a change in the meantime, re-read and try once more.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const file = await readLead(leadId);
      const result = applyOp(file.lead, op);
      await writeLead({ lead: result.lead, sha: file.sha }, `desk: ${result.summary}`);
      if (result.edit) await writeEdit(result.edit.name, result.edit.data);
      return NextResponse.json({ lead: result.lead });
    } catch (e) {
      if (e instanceof ConflictError && attempt === 0) continue;
      const message = e instanceof Error ? e.message : 'Something went wrong';
      return NextResponse.json({ error: message }, { status: e instanceof ConflictError ? 409 : 400 });
    }
  }
  return NextResponse.json({ error: 'Could not save. Refresh and try again.' }, { status: 409 });
}
