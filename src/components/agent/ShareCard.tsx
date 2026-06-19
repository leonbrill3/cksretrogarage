'use client';

import { useState } from 'react';

// One row in an agent's Share dashboard: a for-sale car with one-tap actions to
// share its co-branded link (carrying ?a=<agent>) by copy / WhatsApp / email.
export default function ShareCard({
  title,
  price,
  status,
  cover,
  url,
  message,
}: {
  title: string;
  price: string;
  status: string;
  cover: string;
  url: string;
  message: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: select via a temporary prompt
      window.prompt('Copy this link:', url);
    }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${message}\n\n${url}`)}`;

  const action =
    'flex items-center justify-center gap-2 border border-bone/20 px-3 py-2 text-[11px] uppercase tracking-label text-bone-muted transition-colors hover:border-brass hover:text-bone';

  return (
    <div className="flex flex-col gap-4 border border-bone/10 bg-ink-800 p-4 sm:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover} alt="" className="h-28 w-full shrink-0 object-cover sm:h-24 sm:w-36" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="font-serif text-lg text-bone">{title}</div>
          <span className="shrink-0 text-[10px] uppercase tracking-label text-bone-dim">{status}</span>
        </div>
        <div className="mt-0.5 font-serif text-brass">{price}</div>
        <div className="mt-1 truncate text-[11px] text-bone-dim">{url}</div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button onClick={copy} className={action}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className={action}>
            WhatsApp
          </a>
          <a href={mailHref} className={action}>
            Email
          </a>
        </div>
      </div>
    </div>
  );
}
