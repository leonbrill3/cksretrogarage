'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Counter from 'yet-another-react-lightbox/plugins/counter';
import 'yet-another-react-lightbox/plugins/counter.css';

type Item = { type: 'image' | 'video'; src: string };

// Premium car-listing gallery: a large hero, a thumbnail strip, and a
// full-screen lightbox with swipe + pinch-zoom + neighbour preloading.
// An optional vertical clip is the last item, framed over a blurred fill.
export default function Gallery({
  images,
  title,
  clip,
}: {
  images: string[];
  title: string;
  clip?: string;
}) {
  const items: Item[] = [
    ...images.map((src) => ({ type: 'image' as const, src })),
    ...(clip ? [{ type: 'video' as const, src: clip }] : []),
  ];

  const cover = images[0];
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const fgRef = useRef<HTMLVideoElement>(null);
  const bgRef = useRef<HTMLVideoElement>(null);
  const cur = items[current] || items[0];

  useEffect(() => setPlaying(false), [current]);

  function playVideo() {
    const fg = fgRef.current;
    if (fg) { fg.muted = false; fg.play(); }
    bgRef.current?.play();
    setPlaying(true);
  }

  // Arrow keys move the hero when the lightbox is closed.
  const step = useCallback(
    (dir: number) => setCurrent((i) => (i + dir + items.length) % items.length),
    [items.length],
  );
  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step]);

  const arrow =
    'absolute top-1/2 z-20 -translate-y-1/2 flex h-11 w-11 items-center justify-center bg-ink-900/50 text-bone-muted backdrop-blur-sm transition-colors hover:bg-ink-900/80 hover:text-bone';

  return (
    <>
      {/* Hero */}
      <div className="group relative aspect-[16/10] w-full overflow-hidden bg-ink-900">
        {cur.type === 'video' ? (
          <>
            <video ref={bgRef} key={`bg-${cur.src}`} src={cur.src} poster={cover} muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
            <video ref={fgRef} key={`fg-${cur.src}`} src={cur.src} poster={cover} controls loop playsInline preload="metadata" onPlay={() => setPlaying(true)} className="absolute inset-0 z-10 h-full w-full object-contain" />
            {!playing && (
              <button onClick={playVideo} className="absolute inset-0 z-20 flex items-center justify-center" aria-label="Play video with sound">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-bone/90 text-ink-900 shadow-xl transition-transform hover:scale-105">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              </button>
            )}
          </>
        ) : (
          <Image
            key={cur.src}
            src={cur.src}
            alt={`${title} — ${current + 1}`}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 70vw"
            className="cursor-zoom-in object-contain"
            onClick={() => setOpen(true)}
          />
        )}

        {items.length > 1 && (
          <>
            <button className={`${arrow} left-3`} onClick={() => step(-1)} aria-label="Previous"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.4" /></svg></button>
            <button className={`${arrow} right-3`} onClick={() => step(1)} aria-label="Next"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.4" /></svg></button>
          </>
        )}

        <div className="absolute bottom-3 right-3 z-20 bg-ink-900/60 px-2.5 py-1 text-[11px] tracking-label text-bone-dim backdrop-blur-sm">
          {current + 1} / {items.length}
        </div>
      </div>

      {/* Thumbnails */}
      {items.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {items.map((it, i) => (
            <button
              key={it.src}
              onClick={() => setCurrent(i)}
              className={`relative h-16 w-24 shrink-0 overflow-hidden bg-ink-700 transition-all ${i === current ? 'ring-2 ring-brass' : 'opacity-50 hover:opacity-100'}`}
              aria-label={it.type === 'video' ? 'Video clip' : `Photo ${i + 1}`}
            >
              {it.type === 'video' ? (
                <>
                  <Image src={cover} alt="" fill sizes="96px" className="object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center bg-ink-900/40">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-bone/90 text-[10px] text-ink-900">▶</span>
                  </span>
                </>
              ) : (
                <Image src={it.src} alt="" fill sizes="96px" className="object-cover" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Full-screen lightbox: swipe + pinch-zoom + double-tap (images only) */}
      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={Math.min(current, images.length - 1)}
        slides={images.map((src) => ({ src }))}
        plugins={[Zoom, Counter]}
        zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true, doubleTapDelay: 250 }}
        carousel={{ finite: false, preload: 3 }}
        controller={{ closeOnBackdropClick: true }}
        on={{ view: ({ index }) => setCurrent(index) }}
        styles={{ container: { backgroundColor: 'rgba(13,13,14,0.98)' } }}
      />
    </>
  );
}
