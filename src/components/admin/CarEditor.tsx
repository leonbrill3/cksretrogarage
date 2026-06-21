'use client';

import { useState, useRef, useEffect } from 'react';
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

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function CarEditor({
  car,
  isNew,
  agents = [],
}: {
  car: Car;
  isNew: boolean;
  agents?: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [year, setYear] = useState(String(car.year));
  const [make, setMake] = useState(car.make);
  const [model, setModel] = useState(car.model);
  const [category, setCategory] = useState(car.category);
  const [featured, setFeatured] = useState(!!car.featured);
  const [sold, setSold] = useState(!!car.sold);
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
    car.images.map((name) => ({
      kind: 'existing',
      name,
      url: /^(https?:)?\/\//.test(name) || name.startsWith('/') ? name : `/cars/${car.slug}/${name}`,
    })),
  );

  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [viewer, setViewer] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notify, setNotify] = useState<{ busy: boolean; msg: string }>({ busy: false, msg: '' });
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyPick, setNotifyPick] = useState<string[]>(agents.map((a) => a.id));
  const [dirty, setDirty] = useState(false);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // Vertical video clip (upload a file or paste a hosted URL)
  const videoRef = useRef<HTMLInputElement>(null);
  const existingClipPath = car.clip && car.clip.startsWith('/cars/') ? car.clip : '';
  const initialClipIsUrl = !!car.clip && !car.clip.startsWith('/cars/');
  const [clipData, setClipData] = useState<string | null>(null);
  const [clipExt, setClipExt] = useState('mp4');
  const [clipUrl, setClipUrl] = useState(initialClipIsUrl ? car.clip! : '');
  const [clipRemoved, setClipRemoved] = useState(false);
  const [draggingVideo, setDraggingVideo] = useState(false);
  const clipPreview = clipData || clipUrl.trim() || (!clipRemoved ? existingClipPath : '');

  function autoSlug(nextYear = year, nextMake = make, nextModel = model) {
    if (isNew && !slugTouched) setSlug(slugify(`${nextYear} ${nextMake} ${nextModel}`));
  }

  async function addFiles(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    const added: ImgItem[] = [];
    for (const f of imgs) {
      try {
        const data = await resizeFile(f);
        added.push({ kind: 'new', data, url: data });
      } catch {
        /* skip unreadable */
      }
    }
    if (added.length) { setImages((prev) => [...prev, ...added]); setDirty(true); }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await addFiles(files);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    await addFiles(Array.from(e.dataTransfer?.files || []));
  }

  async function setVideoFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      alert('That doesn’t look like a video file.');
      return;
    }
    if (file.size > 60 * 1024 * 1024) {
      alert('That clip is over 60MB. Please use a smaller file, or paste a hosted video URL instead.');
      return;
    }
    setClipExt((file.name.split('.').pop() || 'mp4').toLowerCase());
    setClipData(await readFileAsDataURL(file));
    setClipUrl('');
    setClipRemoved(false);
    setDirty(true);
  }

  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    await setVideoFile(file);
  }

  async function onDropVideo(e: React.DragEvent) {
    e.preventDefault();
    setDraggingVideo(false);
    const file = Array.from(e.dataTransfer?.files || []).find((f) => f.type.startsWith('video/'));
    await setVideoFile(file);
  }

  function removeClip() {
    setClipData(null);
    setClipUrl('');
    setClipRemoved(true);
    setDirty(true);
  }

  function move(i: number, dir: -1 | 1) {
    setDirty(true);
    setImages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function setCover(i: number) {
    setDirty(true);
    setImages((prev) => {
      const next = [...prev];
      const [item] = next.splice(i, 1);
      next.unshift(item);
      return next;
    });
  }
  function remove(i: number) {
    setDirty(true);
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    // A sellable car must have a minimum price, or it can't be quoted and won't
    // appear in agents' dashboards.
    if (sellable && !(Number(minPrice.replace(/[^0-9.]/g, '')) > 0)) {
      setStatus('error');
      setMessage('Set a minimum price — a sellable car needs a floor before agents can quote it.');
      return;
    }
    setStatus('saving');
    setMessage('');
    // clip: undefined = keep, null = remove, {data}/{url} = set
    const clip = clipData
      ? { data: clipData, ext: clipExt }
      : clipUrl.trim()
        ? { url: clipUrl.trim() }
        : clipRemoved
          ? null
          : undefined;

    const payload = {
      isNew,
      originalSlug: car.slug || undefined,
      clip,
      car: {
        slug: slug.trim(),
        year: Number(year),
        make: make.trim(),
        model: model.trim(),
        category,
        featured,
        sold,
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
      setDirty(false);
      if (isNew) {
        setMessage('Created ✓ — opening…');
        router.replace(`/admin/cars/${payload.car.slug}`);
      } else {
        setMessage('Saved ✓ — live now for agents & quotes.');
        router.refresh();
      }
    } else {
      setStatus('error');
      setMessage(d.error || 'Save failed' + (d.detail ? `: ${d.detail}` : ''));
    }
  }

  async function sendNotifications() {
    if (notifyPick.length === 0) return;
    setNotify({ busy: true, msg: '' });
    setNotifyOpen(false);
    const res = await fetch('/api/admin/notify-agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: car.slug, agentIds: notifyPick }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNotify({ busy: false, msg: d.error || 'Failed' });
    } else if (d.sent > 0) {
      setNotify({ busy: false, msg: `Sent to ${d.sent} agent${d.sent === 1 ? '' : 's'}.` });
    } else {
      setNotify({ busy: false, msg: `Email isn't connected yet — would notify ${d.agents} agent(s).` });
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
    <div className="mt-8 space-y-10 pb-24" onInput={() => setDirty(true)} onChange={() => setDirty(true)}>
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
        <label className="flex items-end gap-2 pb-2.5">
          <input type="checkbox" checked={sold} onChange={(e) => setSold(e.target.checked)} className="accent-oxblood" />
          <span className="text-sm">Sold (shows “Sold”, hides Inquire)</span>
        </label>
      </section>

      {/* Specification — entered once per car, shown on every quote */}
      <section>
        <h2 className="font-serif text-lg">Specification</h2>
        <p className="mb-4 mt-1 text-xs text-bone-dim">
          Entered once when you add the car. Automatically shown to agents and on every quote.
        </p>
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
            <label className={label}>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={field} placeholder="Miami, FL" />
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
            <div className="grid gap-5 sm:grid-cols-2">
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
            </div>
          </div>
        )}
      </section>

      {/* Images */}
      <section
        onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={onDrop}
        className={`rounded p-3 transition-colors ${dragging ? 'bg-brass/10 ring-2 ring-brass' : 'ring-1 ring-transparent'}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Photos ({images.length})</h2>
          <button onClick={() => fileRef.current?.click()} className="btn-ghost !py-2">+ Add photos</button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPick} />
        </div>
        <p className="mb-4 text-xs text-bone-dim">
          Drag photos here from your desktop, or click “Add photos”. First photo is the cover; reorder with the arrows.
        </p>
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 border-2 border-dashed text-xs transition-colors ${
              dragging ? 'border-brass text-brass' : 'border-bone/20 text-bone-dim hover:border-brass/60 hover:text-bone'
            }`}
          >
            <span className="text-2xl leading-none">+</span>
            <span className="px-2 text-center">Drop photos here<br />or click to add</span>
          </button>
        </div>
      </section>

      {/* Video clip */}
      <section
        onDragOver={(e) => { e.preventDefault(); if (!draggingVideo) setDraggingVideo(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDraggingVideo(false); }}
        onDrop={onDropVideo}
        className={`rounded p-3 transition-colors ${draggingVideo ? 'bg-brass/10 ring-2 ring-brass' : 'ring-1 ring-transparent'}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Video clip (vertical reel)</h2>
          <button onClick={() => videoRef.current?.click()} className="btn-ghost !py-2">
            {clipPreview ? 'Replace video' : 'Upload video'}
          </button>
          <input ref={videoRef} type="file" accept="video/*" hidden onChange={onPickVideo} />
        </div>
        <p className="mb-4 text-xs text-bone-dim">
          Drag a video here from your desktop, click “Upload video”, or paste a hosted URL (up to
          60MB). Plays muted on a loop on the car page.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {clipPreview ? (
            <video
              src={clipPreview}
              className="aspect-[9/16] w-40 shrink-0 bg-ink-700 object-cover"
              muted
              controls
              playsInline
            />
          ) : (
            <button
              onClick={() => videoRef.current?.click()}
              className={`flex aspect-[9/16] w-40 shrink-0 flex-col items-center justify-center gap-1 border-2 border-dashed text-xs transition-colors ${
                draggingVideo ? 'border-brass text-brass' : 'border-bone/20 text-bone-dim hover:border-brass/60 hover:text-bone'
              }`}
            >
              <span className="text-2xl leading-none">+</span>
              <span className="px-2 text-center">Drop video here<br />or click to upload</span>
            </button>
          )}

          <div className="flex-1 space-y-3">
            <div>
              <label className={label}>…or paste a video URL</label>
              <input
                value={clipUrl}
                onChange={(e) => { setClipUrl(e.target.value); setClipData(null); setClipRemoved(false); }}
                className={field}
                placeholder="https://… .mp4"
              />
            </div>
            {clipPreview && (
              <button onClick={removeClip} className="text-sm text-oxblood-light hover:text-bone">
                Remove video
              </button>
            )}
          </div>
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
        {!isNew && sellable && (
          <button
            onClick={() => { setNotifyPick(agents.map((a) => a.id)); setNotifyOpen(true); }}
            disabled={notify.busy}
            className="btn-ghost !py-2.5 disabled:opacity-50"
          >
            {notify.busy ? 'Notifying…' : '✉ Notify agents'}
          </button>
        )}
        {!isNew && (
          <button onClick={del} disabled={status === 'saving'} className="text-sm text-oxblood-light hover:text-bone">
            Delete car
          </button>
        )}
        {dirty && status !== 'saving' && (
          <span className="text-sm text-oxblood-light">● Unsaved changes</span>
        )}
        {message && (
          <span className={`text-sm ${status === 'error' ? 'text-oxblood-light' : 'text-brass'}`}>{message}</span>
        )}
        {notify.msg && <span className="text-sm text-brass">{notify.msg}</span>}
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

      {/* Notify-agents picker */}
      {notifyOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/80 p-4" onClick={() => setNotifyOpen(false)}>
          <div className="w-full max-w-md border border-bone/15 bg-ink-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg text-bone">Notify agents</h3>
            <p className="mt-1 text-xs text-bone-dim">
              Choose who gets the “new car to sell” email for {car.year} {car.make} {car.model}.
            </p>

            <div className="mt-4 flex items-center justify-between text-[11px] uppercase tracking-label text-bone-dim">
              <span>{notifyPick.length} of {agents.length} selected</span>
              <button
                onClick={() => setNotifyPick(notifyPick.length === agents.length ? [] : agents.map((a) => a.id))}
                className="text-brass hover:text-bone"
              >
                {notifyPick.length === agents.length ? 'Clear all' : 'Select all'}
              </button>
            </div>

            <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {agents.length === 0 && <p className="text-sm text-bone-dim">No agents available.</p>}
              {agents.map((a) => {
                const on = notifyPick.includes(a.id);
                return (
                  <label key={a.id} className="flex cursor-pointer items-center gap-3 border border-bone/10 bg-ink-900/40 px-3 py-2.5 hover:border-bone/30">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setNotifyPick((prev) => (on ? prev.filter((id) => id !== a.id) : [...prev, a.id]))
                      }
                      className="accent-oxblood"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-bone">{a.name}</span>
                      <span className="block truncate text-xs text-bone-dim">{a.email}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-end gap-4">
              <button onClick={() => setNotifyOpen(false)} className="text-sm text-bone-dim hover:text-bone">Cancel</button>
              <button
                onClick={sendNotifications}
                disabled={notifyPick.length === 0}
                className="btn-primary !py-2.5 disabled:opacity-40"
              >
                Notify {notifyPick.length} agent{notifyPick.length === 1 ? '' : 's'}
              </button>
            </div>
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
