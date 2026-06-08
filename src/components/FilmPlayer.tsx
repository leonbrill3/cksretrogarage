'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

// Vertical film: poster with a play button; click to play with sound in place.
export default function FilmPlayer({
  src,
  poster,
  title,
}: {
  src: string;
  poster: string;
  title: string;
}) {
  const t = useTranslations('car');
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  function play() {
    setPlaying(true);
    // Allow the element to mount before playing.
    requestAnimationFrame(() => ref.current?.play());
  }

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="relative aspect-[9/16] overflow-hidden bg-ink-900">
        {playing ? (
          <video
            ref={ref}
            src={src}
            poster={poster}
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <button onClick={play} className="group absolute inset-0" aria-label={t('watchFilm')}>
            <Image src={poster} alt={title} fill sizes="420px" className="object-cover" />
            <div className="absolute inset-0 bg-ink-900/30 transition-colors group-hover:bg-ink-900/20" />
            <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-bone/60 bg-ink-900/40 backdrop-blur-sm transition-transform group-hover:scale-110">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="ml-1">
                <path d="M6 4l14 8-14 8V4z" fill="currentColor" className="text-bone" />
              </svg>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
