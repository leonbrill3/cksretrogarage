'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

export default function Gallery({ images, title }: { images: string[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);
  const next = useCallback(
    () => setActive((i) => (i === null ? null : (i + 1) % images.length)),
    [images.length],
  );
  const prev = useCallback(
    () => setActive((i) => (i === null ? null : (i - 1 + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [active, close, next, prev]);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        {images.map((src, i) => (
          <button
            key={src}
            onClick={() => setActive(i)}
            className={`group relative overflow-hidden bg-ink-700 ${
              i === 0 ? 'col-span-2 aspect-[16/10] md:col-span-2 md:row-span-2' : 'aspect-[4/3]'
            }`}
          >
            <Image
              src={src}
              alt={`${title} — ${i + 1}`}
              fill
              sizes="(max-width: 768px) 50vw, 33vw"
              priority={i === 0}
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {active !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/97 p-4"
          onClick={close}
        >
          <button
            className="absolute right-6 top-6 text-bone-muted hover:text-bone"
            onClick={close}
            aria-label="Close"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-bone-muted hover:text-bone"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.4" /></svg>
          </button>
          <div className="relative h-[80vh] w-[90vw] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <Image src={images[active]} alt={`${title} — ${active + 1}`} fill className="object-contain" sizes="90vw" />
          </div>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-bone-muted hover:text-bone"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next"
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.4" /></svg>
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs tracking-label text-bone-dim">
            {active + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
