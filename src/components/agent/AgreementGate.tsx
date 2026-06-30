'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AGREEMENT_TITLE,
  AGREEMENT_INTRO,
  AGREEMENT_SECTIONS,
  AGREEMENT_ACCEPTANCE,
} from '@/lib/agent-agreement';

// Shown before an agent can use their dashboard, until they accept the terms.
export default function AgreementGate({ token, agentName }: { token: string; agentName: string }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');

  async function accept() {
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/agent/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed');
      }
      router.refresh();
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-brass">CK’s Retro Garage</div>
      <h1 className="font-serif text-2xl text-bone">
        {agentName ? `Welcome, ${agentName}` : 'Welcome'}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-bone-muted">
        You&apos;re almost set up. Here&apos;s how you earn — then accept the agreement below to
        activate your dashboard.
      </p>

      {/* Plain-English explanation */}
      <div className="mt-6 border border-brass/30 bg-ink-800 p-6">
        <div className="font-serif text-lg text-bone">How you get paid</div>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-bone-muted">
          <li className="flex gap-2"><span className="text-brass">1.</span> Each car has a private <strong className="text-bone">minimum price</strong> set by CK — your floor. Your client never sees it.</li>
          <li className="flex gap-2"><span className="text-brass">2.</span> You choose the <strong className="text-bone">asking price</strong> you quote (at or above the minimum).</li>
          <li className="flex gap-2"><span className="text-brass">3.</span> You keep <strong className="text-bone">70% of everything above the minimum</strong>. At the minimum you earn nothing.</li>
        </ul>
        <div className="mt-3 rounded bg-ink-900/60 p-3 text-xs text-bone-dim">
          <strong className="text-bone">Example:</strong> minimum $100,000, you sell at $120,000 → <strong className="text-brass">you earn $14,000</strong>, CK keeps $106,000.
        </div>
      </div>

      <h2 className="mt-8 font-serif text-xl text-bone">{AGREEMENT_TITLE}</h2>
      <div className="mt-4 max-h-[50vh] overflow-y-auto border border-bone/12 bg-ink-800 p-6">
        <p className="text-sm leading-relaxed text-bone-muted">{AGREEMENT_INTRO}</p>
        <div className="mt-5 space-y-5">
          {AGREEMENT_SECTIONS.map((s) => (
            <div key={s.title}>
              <div className="font-serif text-bone">{s.title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-bone-dim">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-bone/10 pt-5 text-sm leading-relaxed text-bone-muted">
          {AGREEMENT_ACCEPTANCE}
        </p>
      </div>

      <label className="mt-6 flex items-start gap-3 text-sm leading-relaxed text-bone-muted">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 accent-oxblood"
        />
        I have read and agree to the Independent Sales Agent Agreement, and I confirm I am acting as
        an independent contractor, not an employee.
      </label>

      {status === 'error' && <p className="mt-4 text-sm text-oxblood-light">{error}</p>}

      <button
        onClick={accept}
        disabled={!agreed || status === 'saving'}
        className="btn-primary mt-6 disabled:opacity-40"
      >
        {status === 'saving' ? 'Saving…' : 'I agree — continue to my dashboard'}
      </button>
    </div>
  );
}
