'use client';

import { useRef, useState } from 'react';

// Vertical reel: muted autoplay loop; tap to toggle sound.
export default function ShowReel({
  src,
  poster,
  hint,
  aspectClass = 'aspect-[9/16]',
}: {
  src: string;
  poster: string;
  hint: string;
  aspectClass?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && v.paused) v.play();
  }

  return (
    <div className={`relative ${aspectClass} overflow-hidden bg-ink-800`}>
      <video
        ref={ref}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        onClick={toggle}
        className="h-full w-full cursor-pointer object-cover"
      />

      {muted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-ink-900/70 to-transparent pb-5 pt-10">
          <span className="text-[11px] uppercase tracking-label text-bone/90">{hint}</span>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={hint}
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-bone/40 bg-ink-900/50 text-bone backdrop-blur-sm transition-colors hover:bg-ink-900/70"
      >
        {muted ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
            <path d="M17 8l5 8M22 8l-5 8" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
            <path d="M16 8.5a4 4 0 010 7M18.5 6a7 7 0 010 12" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </button>
    </div>
  );
}
