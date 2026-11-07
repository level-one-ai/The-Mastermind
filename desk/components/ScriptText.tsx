import { Fragment, type ReactNode } from 'react';

/**
 * Renders script text the way The Mastermind writes it:
 *  _(stage direction)_  small grey, not read out
 *  They: / You:         objection pairs
 *  Q: / Listen for:     questions and what to listen for
 *  {{variable}}         template blanks (templates only)
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(/(_\([^)]*\)_|\{\{[^}]+\}\})/g);
  return parts.map((p, i) => {
    const key = `${keyBase}-${i}`;
    if (/^_\(.*\)_$/.test(p))
      return (
        <span key={key} className="text-[0.8125rem] italic text-faint">
          {p.slice(1, -1)}
        </span>
      );
    if (/^\{\{.*\}\}$/.test(p))
      return (
        <mark key={key} className="rounded-md bg-status-hold-tint px-1 py-px font-mono text-[0.8em] text-status-hold">
          {p.slice(2, -2)}
        </mark>
      );
    return <Fragment key={key}>{p}</Fragment>;
  });
}

export default function ScriptText({ body, large = false }: { body: string; large?: boolean }) {
  const blocks = body.split(/\n\s*\n/);
  return (
    <div className={`space-y-3 ${large ? 'text-[1.075rem] leading-[1.6]' : 'text-[0.95rem] leading-relaxed'}`}>
      {blocks.map((block, b) => (
        <div key={b} className="space-y-1.5">
          {block.split('\n').map((line, i) => {
            const key = `${b}-${i}`;
            const m = line.match(/^\s*(They|You|Q|Listen for):\s*(.*)$/);
            if (!m) return <p key={key}>{inline(line, key)}</p>;
            const [, tag, rest] = m;
            if (tag === 'They')
              return (
                <p key={key} className="flex gap-3 text-muted">
                  <span className="w-9 shrink-0 pt-px text-xs font-medium uppercase tracking-wide text-faint">They</span>
                  <span>{inline(rest, key)}</span>
                </p>
              );
            if (tag === 'You')
              return (
                <p key={key} className="flex gap-3">
                  <span className="w-9 shrink-0 pt-px text-xs font-medium uppercase tracking-wide text-ink">You</span>
                  <span>{inline(rest, key)}</span>
                </p>
              );
            if (tag === 'Q')
              return (
                <p key={key} className="flex gap-3">
                  <span className="w-9 shrink-0 pt-px text-xs font-medium uppercase tracking-wide text-faint">Ask</span>
                  <span className="font-medium">{inline(rest, key)}</span>
                </p>
              );
            return (
              <p key={key} className="mt-2 rounded-xl bg-canvas-deep px-3 py-2 text-[0.875rem] text-muted">
                <span className="font-medium text-ink">Listen for: </span>
                {inline(rest, key)}
              </p>
            );
          })}
        </div>
      ))}
    </div>
  );
}
