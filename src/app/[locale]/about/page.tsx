import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { cars, carImages } from '@/data/cars';
import { contacts } from '@/data/contacts';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'about' });
  return { title: t('metaTitle'), description: t('intro') };
}

// Photo index (into the cars array) used as each person's portrait placeholder.
const PORTRAIT: Record<string, number> = { andres: 3, cenk: 5 };

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const tc = await getTranslations('contacts');

  // Founder + the two CEOs. Titles for the CEOs are derived from the shared
  // contacts territories so the About page can never drift out of sync.
  const team = [
    { name: 'Cem Köse', img: 1, role: t('roles.founder'), bio: t('bios.founder') },
    ...contacts.map((c) => ({
      name: c.name,
      img: PORTRAIT[c.id],
      role: `${t('ceoLabel')} — ${tc(`${c.id}.label`)}`,
      bio: t(`bios.${c.id}`),
    })),
  ];

  return (
    <div className="pt-28">
      <section className="container-site py-16">
        <div className="max-w-3xl">
          <div className="eyebrow mb-6">{t('eyebrow')}</div>
          <h1 className="h-display text-4xl text-bone md:text-6xl">{t('title')}</h1>
          <p className="mt-7 text-lg leading-relaxed text-bone-muted">{t('intro')}</p>
        </div>
      </section>

      {/* Founder feature */}
      <section className="container-site grid items-center gap-14 py-16 md:grid-cols-2">
        <div className="reveal relative aspect-[4/5] overflow-hidden bg-ink-700">
          <Image
            src={carImages(cars[4])[0]}
            alt="Cem Köse"
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>
        <div className="reveal">
          <div className="eyebrow mb-5">{t('founderEyebrow')}</div>
          <h2 className="h-display text-3xl text-bone md:text-4xl">Cem Köse</h2>
          <p className="mt-6 text-base leading-relaxed text-bone-muted">{t('founderP1')}</p>
          <p className="mt-4 text-base leading-relaxed text-bone-muted">{t('founderP2')}</p>
          <p className="mt-4 text-base leading-relaxed text-bone-muted">{t('founderP3')}</p>
        </div>
      </section>

      {/* Leadership */}
      <section className="border-t border-bone/10 bg-ink-800 py-20">
        <div className="container-site">
          <div className="mb-12 max-w-2xl">
            <div className="eyebrow mb-5">{t('teamEyebrow')}</div>
            <h2 className="h-display text-3xl text-bone md:text-4xl">{t('teamTitle')}</h2>
            <p className="mt-5 text-base leading-relaxed text-bone-dim">{t('teamIntro')}</p>
          </div>
          <div className="grid gap-x-8 gap-y-12 md:grid-cols-3">
            {team.map((m) => (
              <div key={m.name} className="reveal">
                <div className="relative aspect-[3/4] overflow-hidden bg-ink-700">
                  <Image
                    src={carImages(cars[m.img])[0]}
                    alt={m.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover opacity-90"
                  />
                </div>
                <h3 className="mt-5 font-serif text-2xl text-bone">{m.name}</h3>
                <div className="mt-1 text-[11px] uppercase tracking-label text-brass">
                  {m.role}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-bone-dim">{m.bio}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-xs text-bone-dim">{t('photoNote')}</p>
        </div>
      </section>

      <section className="border-t border-bone/10 bg-oxblood-deep">
        <div className="container-site flex flex-col items-center gap-6 py-20 text-center">
          <h2 className="h-display max-w-2xl text-3xl text-bone">{t('ctaTitle')}</h2>
          <Link href="/source" className="inline-flex items-center justify-center gap-2 bg-bone px-8 py-4 text-[12px] font-medium uppercase tracking-label text-ink-900 transition-opacity hover:opacity-90">
            {t('ctaButton')}
          </Link>
        </div>
      </section>
    </div>
  );
}
