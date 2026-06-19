'use client';

import { useState } from 'react';

const COMMISSION_RATE = 0.7;
const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'nl', label: 'Nederlands' },
];

function fmt(n: number, cur: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${cur} ${Math.round(n).toLocaleString('en-US')}`;
  }
}

// Per-car quoting row in an agent's dashboard: set an asking price, see the
// live commission, pick the customer's language, and mint a signed quote link.
export default function QuoteBuilder({
  token,
  slug,
  title,
  cover,
  minPrice,
  currency,
}: {
  token: string;
  slug: string;
  title: string;
  cover: string;
  minPrice: number;
  currency: string;
}) {
  const [asking, setAsking] = useState(String(minPrice));
  const [lang, setLang] = useState('en');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const askingNum = Number(asking.replace(/[^0-9.]/g, ''));
  const valid = Number.isFinite(askingNum) && askingNum >= minPrice;
  const commission = valid ? Math.round((askingNum - minPrice) * COMMISSION_RATE) : 0;
  const ckTakes = valid ? askingNum - commission : minPrice;

  async function create() {
    setStatus('working');
    setError('');
    setUrl('');
    try {
      const res = await fetch('/api/agent/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, askingPrice: askingNum, locale: lang }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setUrl(d.url);
      setStatus('done');
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  const msg = `Hi — here is the ${title} I mentioned, priced at ${fmt(askingNum, currency)}.`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${msg} ${url}`)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${msg}\n\n${url}`)}`;

  const action =
    'flex items-center justify-center gap-2 border border-bone/20 px-3 py-2 text-[11px] uppercase tracking-label text-bone-muted transition-colors hover:border-brass hover:text-bone';
  const fieldCls = 'w-full border border-bone/15 bg-ink-900 px-3 py-2 text-bone focus:border-brass focus:outline-none';

  return (
    <div className="flex flex-col gap-4 border border-bone/10 bg-ink-800 p-4 sm:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover} alt="" className="h-28 w-full shrink-0 object-cover sm:h-auto sm:w-40" />

      <div className="min-w-0 flex-1">
        <div className="font-serif text-lg text-bone">{title}</div>
        <div className="mt-0.5 text-xs text-bone-dim">
          Your minimum (private): <span className="text-bone">{fmt(minPrice, currency)}</span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-label text-bone-dim">
              Asking price ({currency})
            </label>
            <input
              value={asking}
              onChange={(e) => { setAsking(e.target.value); setStatus('idle'); setUrl(''); }}
              inputMode="numeric"
              className={fieldCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-label text-bone-dim">
              Customer&apos;s language
            </label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className={fieldCls}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>

        {/* Live commission readout */}
        <div className="mt-3 border-l-2 border-brass/60 bg-ink-900/50 px-3 py-2 text-sm">
          {valid ? (
            <>
              <span className="text-bone-dim">You earn </span>
              <span className="font-serif text-lg text-brass">{fmt(commission, currency)}</span>
              <span className="text-bone-dim"> — 70% of {fmt(askingNum - minPrice, currency)} above your minimum. CK keeps {fmt(ckTakes, currency)}.</span>
            </>
          ) : (
            <span className="text-oxblood-light">
              Asking price must be at least your minimum ({fmt(minPrice, currency)}). At the minimum you earn nothing.
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={create}
            disabled={!valid || status === 'working'}
            className="btn-primary !py-2 !px-4 text-xs disabled:opacity-40"
          >
            {status === 'working' ? 'Creating…' : 'Create quote link'}
          </button>
          {error && <span className="text-xs text-oxblood-light">{error}</span>}
        </div>

        {url && (
          <div className="mt-3 space-y-2 border-t border-bone/10 pt-3">
            <div className="truncate text-[11px] text-brass">{url}</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={copy} className={action}>{copied ? '✓ Copied' : 'Copy'}</button>
              <a href={waHref} target="_blank" rel="noopener noreferrer" className={action}>WhatsApp</a>
              <a href={mailHref} className={action}>Email</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
