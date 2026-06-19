'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

// Inquiry form shown on a for-sale listing. Posts to /api/source with the
// car title + (optional) agent id so the lead is routed to that agent and
// logged centrally.
export default function ListingInquiryForm({
  carTitle,
  carSlug,
  agentId,
}: {
  carTitle: string;
  carSlug: string;
  agentId?: string;
}) {
  const t = useTranslations('inquiry');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch('/api/source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          car: carTitle,
          slug: carSlug,
          agent: agentId || '',
          source: 'listing-inquiry',
        }),
      });
      if (!res.ok) throw new Error('failed');
      setStatus('sent');
      form.reset();
    } catch {
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="border border-brass/30 bg-ink-800 p-8 text-center">
        <p className="text-brass">{t('success')}</p>
      </div>
    );
  }

  const field =
    'w-full border-b border-bone/20 bg-transparent py-2.5 text-bone placeholder:text-bone-dim/60 focus:border-brass focus:outline-none transition-colors';
  const label = 'block text-[11px] uppercase tracking-label text-bone-dim mb-2';

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="iq-name">{t('name')}</label>
          <input id="iq-name" name="name" required className={field} />
        </div>
        <div>
          <label className={label} htmlFor="iq-email">{t('email')}</label>
          <input id="iq-email" name="email" type="email" required className={field} />
        </div>
        <div>
          <label className={label} htmlFor="iq-phone">{t('phone')}</label>
          <input id="iq-phone" name="phone" className={field} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="iq-message">{t('message')}</label>
        <textarea
          id="iq-message"
          name="details"
          rows={3}
          className={field}
          defaultValue={t('messagePlaceholder')}
        />
      </div>

      <label className="flex items-start gap-3 text-xs leading-relaxed text-bone-dim">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-oxblood" />
        {t('consent')}
      </label>

      {status === 'error' && <p className="text-sm text-oxblood-light">{t('error')}</p>}

      <button type="submit" disabled={status === 'sending'} className="btn-primary disabled:opacity-50">
        {status === 'sending' ? t('sending') : t('submit')}
      </button>
    </form>
  );
}
