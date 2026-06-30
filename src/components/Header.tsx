'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import LanguageSwitcher from './LanguageSwitcher';

const NAV = [
  { href: '/collection', key: 'collection' },
  { href: '/process', key: 'process' },
  { href: '/sell', key: 'sell' },
  { href: '/storage', key: 'storage' },
  { href: '/about', key: 'about' },
  { href: '/contact', key: 'contact' },
] as const;

export default function Header({ locale }: { locale: string }) {
  const t = useTranslations('nav');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        scrolled || menuOpen
          ? 'bg-ink-900/95 backdrop-blur-md border-b border-bone/10'
          : 'bg-gradient-to-b from-ink-900/70 to-transparent'
      }`}
    >
      <div className="container-site flex h-[72px] items-center justify-between">
        <Link href="/" className="group flex flex-col leading-none">
          <span className="font-serif text-[19px] tracking-[0.02em] text-bone">
            CK’s Retro Garage
          </span>
          <span className="mt-0.5 text-[9px] uppercase tracking-[0.3em] text-brass">
            Connoisseur Acquisitions
          </span>
        </Link>

        <nav className="hidden items-center gap-9 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="link-underline text-[12px] uppercase tracking-label text-bone-muted transition-colors hover:text-bone"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-5">
          <LanguageSwitcher locale={locale} />
          <Link href="/source" className="hidden btn-primary !px-5 !py-2.5 sm:inline-flex">
            {t('cta')}
          </Link>
          <button
            className="lg:hidden text-bone"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            <div className="space-y-[5px]">
              <span className={`block h-px w-6 bg-current transition-transform ${menuOpen ? 'translate-y-[6px] rotate-45' : ''}`} />
              <span className={`block h-px w-6 bg-current transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
              <span className={`block h-px w-6 bg-current transition-transform ${menuOpen ? '-translate-y-[6px] -rotate-45' : ''}`} />
            </div>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-bone/10 bg-ink-900 lg:hidden">
          <nav className="container-site flex flex-col py-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="border-b border-bone/5 py-4 text-[13px] uppercase tracking-label text-bone-muted"
              >
                {t(item.key)}
              </Link>
            ))}
            <Link href="/source" className="btn-primary mt-5">
              {t('cta')}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
