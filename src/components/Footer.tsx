import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { contacts } from '@/data/contacts';

export default function Footer({ locale }: { locale: string }) {
  const t = useTranslations('footer');
  const tn = useTranslations('nav');
  const tc = useTranslations('contacts');

  return (
    <footer className="border-t border-bone/10 bg-ink-800">
      <div className="container-site py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="font-serif text-2xl text-bone">CK Retro Garage</div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-bone-dim">
              {t('blurb')}
            </p>
          </div>

          <div>
            <div className="eyebrow mb-5">{t('explore')}</div>
            <ul className="space-y-3 text-sm text-bone-muted">
              {['collection', 'process', 'storage', 'about', 'contact'].map((k) => (
                <li key={k}>
                  <Link href={`/${k}`} className="link-underline hover:text-bone">
                    {tn(k)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="eyebrow mb-5">{t('regions')}</div>
            <ul className="space-y-3 text-sm text-bone-muted">
              {contacts.map((c) => (
                <li key={c.id}>
                  {c.name} — {tc(`${c.id}.label`)}
                </li>
              ))}
            </ul>
            <a
              href="https://collection-suites.com"
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline mt-5 inline-block text-sm text-brass"
            >
              {t('custody')} ↗
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-bone/10 pt-8 text-xs text-bone-dim md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} CK Retro Garage. {t('rights')}
          </span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-bone-muted">
              {t('privacy')}
            </Link>
            <Link href="/contact" className="hover:text-bone-muted">
              {tn('contact')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
