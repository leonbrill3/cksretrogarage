'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export default function SellForm() {
  const t = useTranslations('sell');
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
        body: JSON.stringify({ ...data, intent: 'sell' }),
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
      <div className="border border-brass/30 bg-ink-800 p-12 text-center">
        <div className="font-serif text-3xl text-brass">{t('successTitle')}</div>
        <p className="mt-4 text-bone-muted">{t('successBody')}</p>
      </div>
    );
  }

  const field =
    'w-full border-b border-bone/20 bg-transparent py-3 text-bone placeholder:text-bone-dim/60 focus:border-brass focus:outline-none transition-colors';
  const label = 'block text-[11px] uppercase tracking-label text-bone-dim mb-2';

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">{t('fields.name')}</label>
          <input id="name" name="name" required className={field} placeholder={t('ph.name')} />
        </div>
        <div>
          <label className={label} htmlFor="email">{t('fields.email')}</label>
          <input id="email" name="email" type="email" required className={field} placeholder={t('ph.email')} />
        </div>
        <div>
          <label className={label} htmlFor="phone">{t('fields.phone')}</label>
          <input id="phone" name="phone" className={field} placeholder={t('ph.phone')} />
        </div>
        <div>
          <label className={label} htmlFor="country">{t('fields.country')}</label>
          <input id="country" name="country" className={field} placeholder={t('ph.country')} />
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="car">{t('fields.car')}</label>
          <input id="car" name="car" required className={field} placeholder={t('ph.car')} />
        </div>
        <div>
          <label className={label} htmlFor="price">{t('fields.price')}</label>
          <input id="price" name="price" className={field} placeholder={t('ph.price')} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="details">{t('fields.details')}</label>
        <textarea id="details" name="details" rows={4} className={field} placeholder={t('ph.details')} />
      </div>

      <label className="flex items-start gap-3 text-xs leading-relaxed text-bone-dim">
        <input type="checkbox" name="consent" required className="mt-0.5 accent-oxblood" />
        {t('consent')}
      </label>

      {status === 'error' && <p className="text-sm text-oxblood-light">{t('errorMsg')}</p>}

      <button type="submit" disabled={status === 'sending'} className="btn-primary disabled:opacity-50">
        {status === 'sending' ? t('sending') : t('submit')}
      </button>
    </form>
  );
}
