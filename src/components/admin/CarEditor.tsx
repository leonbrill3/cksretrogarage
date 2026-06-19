'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Car } from '@/data/cars';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'AED'] as const;

type ImgItem =
  | { kind: 'existing'; name: string; url: string }
  | { kind: 'new'; data: string; url: string };

const CATEGORIES = ['grand-touring', 'sports', 'rally', 'collector'] as const;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Resize an image File to a max dimension and return a JPEG data URL.
function resizeFile(file: File, max = 1920, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = () => (img.src = reader.result as string);
    reader.onerror = reject;
    img.onload = () => {
      let { width, height } = img;
      if (width > max || height > max) {
        const r = Math.min(max / width, max / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no canvas'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CarEditor({ car, isNew }: { car: Car; isNew: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [year, setYear] = useState(String(car.year));
  const [make, setMake] = useState(car.make);
  const [model, setModel] = useState(car.model);
  const [category, setCategory] = useState(car.category);
  const [featured, setFeatured] = useState(!!car.featured);
  const [slug, setSlug] = useState(car.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);

  const [tagEn, setTagEn] = useState(car.tagline.en);
  const [tagTr, setTagTr] = useState(car.tagline.tr || '');
  const [descEn, setDescEn] = useState(car.description.en);
  const [descTr, setDescTr] = useState(car.description.tr || '');
  const [inspEn, setInspEn] = useState((car.inspection.en || []).join('\n'));
  const [inspTr, setInspTr] = useState((car.inspection.tr || []).join('\n'));

  // Internal selling fields (never shown publicly)
  const [sellable, setSellable] = useState(!!car.sellable);
  const [minPrice, setMinPrice] = useState(car.minPrice != null ? String(car.minPrice) : '');
  const [currency, setCurrency] = useState(car.currency || 'EUR');
  const [location, setLocation] = useState(car.location || '');
  const [mileage, setMileage] = useState(car.specs?.mileage || '');
  const [transmission, setTransmission] = useState(car.specs?.transmission || '');
  const [engine, setEngine] = useState(car.specs?.engine || '');
  const [exterior, setExterior] = useState(car.specs?.exterior || '');
  const [interior, setInterior] = useState(car.specs?.interior || '');

  const [images, setImages] = useState<ImgItem[]>(
    car.images.map((name) => ({ kind: 'existing', name, url: `/cars/${car.slug}/${name}` })),
  );

  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [viewer, setViewer] = useState<number | null>(null);

  function autoSlug(nextYear = year, nextMake = make, nextModel = model) {
    if (isNew && !slugTouched) setSlug(slugify(`${nextYear} ${nextMake} ${nextModel}`));
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const added: ImgItem[] = [];
    for (const f of files) {
      try {
        const data = await resizeFile(f);
        added.push({ kind: 'new', data, url: data });
      } catch {
        /* skip unreadable */
      }
    }
    setImages((prev) => [...prev, ...added]);
  }

  function move(i: number, dir: -1 | 1) {
    setImages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function setCover(i: number) {
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.unshift(item);
      return next;
    });
  }
  function remove(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setStatus('saving');
    setMessage('');
    const payload = {
      isNew,
      originalSlug: car.slug || undefined,
      car: {
        slug: slug.trim(),
        year: Number(year),
        make: make.trim(),
        model: model.trim(),
        category,
        featured,
        sellable,
        minPrice: minPrice.trim() ? Number(minPrice.replace(/[^0-9.]/g, '')) : undefined,
        currency,
        location: location.trim(),
        specs: {
          mileage: mileage.trim(),
          transmission: transmission.trim(),
          engine: engine.trim(),
          exterior: exterior.trim(),
          interior: interior.trim(),
        },
        tagline: { en: tagEn, tr: tagTr },
        description: { en: descEn, tr: descTr },
        inspection: {
          en: inspEn.split('\n').map((s) => s.trim()).filter(Boolean),
          tr: inspTr.split('\n').map((s) => s.trim()).filter(Boolean),
        },
      },
      images: images.map((im) =>
        im.kind === 'existing'
          ? { type: 'existing', name: im.name }
          : { type: 'new', data: im.data, ext: 'jpg' },
      ),
    };
    const res = await fetch('/api/admin/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus('done');
      setMessage('Saved. The live site will update in ~2 minutes.');
      setTimeout(() => router.push('/admin'), 1500);
    } else {
      setStatus('error');
      setMessage(d.error || 'Save failed' + (d.detail ? `: ${d.detail}` : ''));
    }
  }

  async function del() {
    if (!confirm(`Delete ${car.year} ${car.make} ${car.model}? This cannot be undone.`)) return;
    setStatus('saving');
    const res = await fetch('/api/admin/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteCar: true, originalSlug: car.slug }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus('done');
      setMessage('Deleted. Redirecting…');
      setTimeout(() => router.push('/admin'), 1200);
    } else {
      setStatus('error');
      setMessage(d.error || 'Delete failed');
    }
  }

  const field = 'w-full border border-bone/15 bg-ink-800 px-3 py-2.5 text-bone focus:border-brass focus:outline-none';
  const label = 'mb-1.5 block text-[11px] uppercase tracking-[0.22em] text-bone-dim';

  return (
    <div className="mt-8 space-y-10 pb-24">
      {/* Basics */}
      <section className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className={label}>Year</label>
          <input value={year} onChange={(e) => { setYear(e.target.value); autoSlug(e.target.value); }} className={field} inputMode="numeric" />
        </div>
        <div>
          <label className={label}>Make</label>
          <input value={make} onChange={(e) => { setMake(e.target.value); autoSlug(year, e.target.value); }} className={field} />
        </div>
        <div>
          <label className={label}>Model</label>
          <input value={model} onChange={(e) => { setModel(e.target.value); autoSlug(year, make, e.target.value); }} className={field} />
        </div>
        <div>
          <label className={label}>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as Car['category'])} className={field}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>URL slug</label>
          <input value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} className={field} disabled={!isNew} />
        </div>
        <label className="flex items-end gap-2 pb-2.5">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-oxblood" />
          <span className="text-sm">Featured on homepage</span>
        </label>
      </section>

      {/* Selling (internal only) */}
      <section className="border border-bone/10 bg-ink-800/40 p-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={sellable}
            onChange={(e) => setSellable(e.target.checked)}
            className="accent-oxblood"
          />
          <span className="font-serif text-lg">Make this car sellable (agents can quote it)</span>
        </label>

        {sellable && (
          <div className="mt-6 space-y-5">
            <div className="rounded border border-brass/30 bg-ink-900/40 p-3 text-xs leading-relaxed text-bone-dim">
              🔒 The minimum price is <strong>internal only</strong> — agents see it, customers never
              do. Agents quote above it and earn 70% of the difference.
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label className={label}>Minimum price (your floor)</label>
                <input
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className={field}
                  inputMode="numeric"
                  placeholder="185000"
                />
              </div>
              <div>
                <label className={label}>Currency</label>
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Location</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className={field}
                  placeholder="Istanbul, Türkiye"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-bone-dim">Spec sheet (optional)</div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={label}>Mileage</label>
                  <input value={mileage} onChange={(e) => setMileage(e.target.value)} className={field} placeholder="42,000 km" />
                </div>
                <div>
                  <label className={label}>Transmission</label>
                  <input value={transmission} onChange={(e) => setTransmission(e.target.value)} className={field} placeholder="5-speed manual" />
                </div>
                <div>
                  <label className={label}>Engine</label>
                  <input value={engine} onChange={(e) => setEngine(e.target.value)} className={field} placeholder="3.0L V8" />
                </div>
                <div>
                  <label className={label}>Exterior</label>
                  <input value={exterior} onChange={(e) => setExterior(e.target.value)} className={field} placeholder="Rosso Corsa" />
                </div>
                <div>
                  <label className={label}>Interior</label>
                  <input value={interior} onChange={(e) => setInterior(e.target.value)} className={field} placeholder="Nero leather" />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Images */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Photos ({images.length})</h2>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-2">+ Add photos</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
        </div>
        <p className="mb-4 text-xs text-bone-dim">First photo is the cover. Drag-free reorder with the arrows.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((im, i) => (
            <div key={im.kind === 'existing' ? im.name : `new-${i}`} className="group relative aspect-[4/3] overflow-hidden bg-ink-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={im.url}
                alt=""
                onClick={() => setViewer(i)}
                className="h-full w-full cursor-zoom-in object-cover"
                title="Click to enlarge"
              />
              {i === 0 && <span className="absolute left-1.5 top-1.5 bg-brass px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-ink-900">Cover</span>}
              {im.kind === 'new' && <span className="absolute right-1.5 top-1.5 bg-oxblood px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-bone">New</span>}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink-900/80 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => move(i, -1)} className="px-1.5 text-bone-muted hover:text-bone" title="Move left">←</button>
                <button onClick={() => setCover(i)} className="text-[10px] uppercase tracking-wide text-bone-muted hover:text-brass" title="Set as cover">cover</button>
                <button onClick={() => move(i, 1)} className="px-1.5 text-bone-muted hover:text-bone" title="Move right">→</button>
                <button onClick={() => remove(i)} className="px-1.5 text-oxblood-light hover:text-bone" title="Remove">✕</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Text — English + Turkish */}
      <section className="space-y-6">
        <h2 className="font-serif text-lg">Text</h2>
        <TwoLang label="Tagline" en={tagEn} tr={tagTr} setEn={setTagEn} setTr={setTagTr} />
        <TwoLang label="Description" en={descEn} tr={descTr} setEn={setDescEn} setTr={setDescTr} rows={4} />
        <TwoLang
          label="Inspection points (one per line)"
          en={inspEn} tr={inspTr} setEn={setInspEn} setTr={setInspTr} rows={5}
        />
      </section>

      {/* Actions */}
      <section className="flex flex-wrap items-center gap-4 border-t border-bone/10 pt-6">
        <button onClick={save} disabled={status === 'saving'} className="btn-primary disabled:opacity-50">
          {status === 'saving' ? 'Saving…' : isNew ? 'Create car' : 'Save changes'}
        </button>
        {!isNew && (
          <button onClick={del} disabled={status === 'saving'} className="text-sm text-oxblood-light hover:text-bone">
            Delete car
          </button>
        )}
        {message && (
          <span className={`text-sm ${status === 'error' ? 'text-oxblood-light' : 'text-brass'}`}>{message}</span>
        )}
      </section>

      {/* Full-screen photo viewer */}
      {viewer !== null && images[viewer] && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/97 p-4"
          onClick={() => setViewer(null)}
        >
          <button
            className="absolute right-6 top-6 text-2xl text-bone-muted hover:text-bone"
            onClick={() => setViewer(null)}
            aria-label="Close"
          >
            ✕
          </button>
          {images.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-3xl text-bone-muted hover:text-bone"
              onClick={(e) => { e.stopPropagation(); setViewer((v) => (v === null ? null : (v - 1 + images.length) % images.length)); }}
              aria-label="Previous"
            >
              ‹
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[viewer].url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] max-w-[92vw] object-contain"
          />
          {images.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-3xl text-bone-muted hover:text-bone"
              onClick={(e) => { e.stopPropagation(); setViewer((v) => (v === null ? null : (v + 1) % images.length)); }}
              aria-label="Next"
            >
              ›
            </button>
          )}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-label text-bone-dim">
            {viewer + 1} / {images.length}
          </div>
        </div>
      )}
    </div>
  );
}

function TwoLang({
  label, en, tr, setEn, setTr, rows = 2,
}: {
  label: string; en: string; tr: string;
  setEn: (v: string) => void; setTr: (v: string) => void; rows?: number;
}) {
  const cls = 'w-full border border-bone/15 bg-ink-800 px-3 py-2.5 text-bone focus:border-brass focus:outline-none';
  return (
    <div>
      <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-bone-dim">{label}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-brass">English</div>
          <textarea value={en} onChange={(e) => setEn(e.target.value)} rows={rows} className={cls} />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-wider text-brass">Türkçe</div>
          <textarea value={tr} onChange={(e) => setTr(e.target.value)} rows={rows} className={cls} placeholder="(falls back to English if empty)" />
        </div>
      </div>
    </div>
  );
}
