'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export default function CopyButton({
  text,
  label,
  variant = 'ghost',
  className = '',
}: {
  text: string;
  label: string;
  variant?: 'primary' | 'ghost' | 'quiet';
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${className}`}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        }
      }}
      aria-live="polite"
    >
      {done ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      {done ? 'Copied' : label}
    </button>
  );
}
