import Image from 'next/image';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { cars, carImages } from '@/data/cars';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'storage' });
  return { title: t('metaTitle'), description: t('intro') };
}

export default async function StoragePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('storage');

  const features = ['climate', 'security', 'maintenance', 'access'] as const;

  return (
    <div className="pt-28">
      <section className="container-site py-16">
        <div className="max-w-3xl">
          <div className="eyebrow mb-6">{t('eyebrow')}</div>
          <h1 className="h-display text-4xl text-bone md:text-6xl">{t('title')}</h1>
          <p className="mt-7 text-lg leading-relaxed text-bone-muted">{t('intro')}</p>
        </div>
      </section>

      <section className="relative my-8 overflow-hidden">
        <div className="relative aspect-[21/9]">
          <Image
            src={carImages(cars[3])[1] ?? carImages(cars[3])[0]}
            alt={t('imageAlt')}
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 to-transparent" />
        </div>
      </section>

      <section className="container-site py-16">
        <div className="grid gap-x-12 gap-y-12 md:grid-cols-2">
          {features.map((f) => (
            <div key={f} className="reveal border-t border-bone/10 pt-6">
              <h3 className="font-serif text-2xl text-bone">{t(`features.${f}.title`)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-bone-dim">{t(`features.${f}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-bone/10 bg-ink-800">
        <div className="container-site flex flex-col items-center gap-6 py-20 text-center">
          <div className="eyebrow">{t('partnerEyebrow')}</div>
          <h2 className="h-display max-w-2xl text-3xl text-bone">{t('partnerTitle')}</h2>
          <p className="max-w-xl text-base leading-relaxed text-bone-dim">{t('partnerBody')}</p>
          <a
            href="https://collection-suites.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
          >
            collection-suites.com ↗
          </a>
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
