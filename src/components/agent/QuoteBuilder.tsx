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
const SPEC_LABELS: Record<string, string> = {
  mileage: 'Mileage',
  transmission: 'Transmission',
  engine: 'Engine',
  exterior: 'Exterior',
  interior: 'Interior',
};

export default function QuoteBuilder({
  token,
  slug,
  title,
  cover,
  minPrice,
  currency,
  location = '',
  specs = [],
  agentName = '',
  agentEmail = '',
  agentPhone = '',
}: {
  token: string;
  slug: string;
  title: string;
  cover: string;
  minPrice: number;
  currency: string;
  location?: string;
  specs?: [string, string][];
  agentName?: string;
  agentEmail?: string;
  agentPhone?: string;
}) {
  const [asking, setAsking] = useState(String(minPrice));
  const [lang, setLang] = useState('en');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [custEmail, setCustEmail] = useState('');
  const [custMsg, setCustMsg] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailMsg, setEmailMsg] = useState('');

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

  async function sendBrandedEmail() {
    if (!custEmail.trim()) { setEmailStatus('error'); setEmailMsg('Enter the client’s email.'); return; }
    setEmailStatus('sending');
    setEmailMsg('');
    try {
      const res = await fetch('/api/agent/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, slug, askingPrice: askingNum, locale: lang, to: custEmail.trim(), message: custMsg }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setEmailStatus('sent');
      setEmailMsg(d.sent ? `Sent to ${d.to} ✓` : `Email isn’t connected yet — nothing sent.`);
    } catch (e) {
      setEmailStatus('error');
      setEmailMsg(e instanceof Error ? e.message : 'Failed');
    }
  }

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

        {(specs.length > 0 || location) && (
          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 border-y border-bone/10 py-3 sm:grid-cols-3">
            {location && (
              <div>
                <dt className="text-[10px] uppercase tracking-label text-bone-dim/70">Location</dt>
                <dd className="mt-0.5 text-sm text-bone">{location}</dd>
              </div>
            )}
            {specs.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] uppercase tracking-label text-bone-dim/70">{SPEC_LABELS[k] || k}</dt>
                <dd className="mt-0.5 text-sm text-bone">{v}</dd>
              </div>
            ))}
          </dl>
        )}

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

        {!url && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={create}
              disabled={!valid || status === 'working'}
              className="btn-primary !py-2 !px-4 text-xs disabled:opacity-40"
            >
              {status === 'working' ? 'Creating…' : 'Create quote → send it'}
            </button>
            <span className="text-[11px] text-bone-dim">Then send by Email, WhatsApp, or copy the link.</span>
            {error && <span className="text-xs text-oxblood-light">{error}</span>}
          </div>
        )}

        {url && (
          <div className="mt-3 space-y-2 border-t border-bone/10 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-label text-brass">✓ Quote ready — send it</span>
              <button onClick={() => { setUrl(''); setEmailOpen(false); }} className="text-[11px] text-bone-dim hover:text-bone">change price ↻</button>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 border border-brass bg-brass/10 px-3 py-2.5 text-[12px] uppercase tracking-label text-brass transition-colors hover:bg-brass hover:text-ink-900"
            >
              👁 Preview what your client will see ↗
            </a>
            <div className="truncate text-[11px] text-bone-dim">{url}</div>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={copy} className={action}>{copied ? '✓ Copied' : 'Copy link'}</button>
              <a href={waHref} target="_blank" rel="noopener noreferrer" className={action}>WhatsApp</a>
              <button onClick={() => setEmailOpen((v) => !v)} className={action}>✉ Email</button>
            </div>

            {emailOpen && (
              <div className="space-y-3 border border-bone/15 bg-ink-900/50 p-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-label text-bone-dim">Send to (client email)</label>
                  <input
                    value={custEmail}
                    onChange={(e) => setCustEmail(e.target.value)}
                    placeholder="client@email.com"
                    className={fieldCls}
                    type="email"
                  />
                </div>

                <div className="text-[10px] uppercase tracking-label text-bone-dim">Email preview — edit your note below</div>

                {/* Editable branded email preview (mirrors what the client receives) */}
                <div className="overflow-hidden border border-bone/15 bg-[#161617]">
                  <div className="border-b border-bone/10 px-5 py-4">
                    <div className="font-serif text-lg text-bone">CK Retro Garage</div>
                    <div className="text-[9px] uppercase tracking-[0.3em] text-brass">Connoisseur Acquisitions</div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt="" className="h-40 w-full object-cover" />
                  <div className="space-y-3 px-5 py-4">
                    <textarea
                      value={custMsg}
                      onChange={(e) => setCustMsg(e.target.value)}
                      rows={3}
                      placeholder="Add a personal note to your client… (e.g. “Thought of you for this one — happy to arrange a viewing.”)"
                      className="w-full resize-none border border-dashed border-bone/20 bg-ink-900/40 px-2 py-1.5 text-sm text-bone-muted focus:border-brass focus:outline-none"
                    />
                    <div className="text-[10px] uppercase tracking-label text-brass">A car selected for you</div>
                    <div className="font-serif text-xl text-bone">{title}</div>
                    <div className="font-serif text-lg text-brass">{fmt(askingNum, currency)}</div>
                    {location && <div className="text-xs text-bone-dim">{location}</div>}
                    {specs.length > 0 && (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-bone/10 pt-3 text-xs">
                        {specs.slice(0, 4).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-bone-dim/70">{SPEC_LABELS[k] || k}</dt>
                            <dd className="text-bone">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div className="inline-block bg-oxblood px-4 py-2 text-[11px] uppercase tracking-label text-bone">View full details &amp; photos →</div>
                    <div className="border-t border-bone/10 pt-3 text-xs text-bone-dim">
                      <span className="text-bone">{agentName}</span> · CK Retro Garage<br />
                      {agentEmail}{agentPhone ? ` · ${agentPhone}` : ''}
                    </div>
                  </div>
                </div>

                <button
                  onClick={sendBrandedEmail}
                  disabled={emailStatus === 'sending'}
                  className="btn-primary !py-2 !px-4 text-xs disabled:opacity-40"
                >
                  {emailStatus === 'sending' ? 'Sending…' : 'Send this email'}
                </button>
                {emailMsg && (
                  <p className={`text-[11px] ${emailStatus === 'error' ? 'text-oxblood-light' : 'text-brass'}`}>{emailMsg}</p>
                )}
                <p className="text-[11px] text-bone-dim">This is exactly what your client receives. Replies come straight to you.</p>
              </div>
            )}

            <p className="text-[11px] text-bone-dim">Preview opens the exact page your client sees — your minimum and commission never appear there.</p>
          </div>
        )}
      </div>
    </div>
  );
}
