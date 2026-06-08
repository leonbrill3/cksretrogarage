'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { routing, localeNames } from '@/i18n/routing';

export default function LanguageSwitcher({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function switchTo(next: string) {
    router.replace(pathname, { locale: next });
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] uppercase tracking-label text-bone-muted transition-colors hover:text-bone"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {locale}
        <svg width="9" height="9" viewBox="0 0 10 6" fill="none" aria-hidden>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open && (
        <ul
          className="absolute right-0 z-50 mt-3 min-w-[150px] border border-bone/15 bg-ink-800 py-1 shadow-2xl"
          role="listbox"
        >
          {routing.locales.map((l) => (
            <li key={l}>
              <button
                onClick={() => switchTo(l)}
                className={`block w-full px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-ink-700 ${
                  l === locale ? 'text-brass' : 'text-bone-muted'
                }`}
                role="option"
                aria-selected={l === locale}
              >
                {localeNames[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
