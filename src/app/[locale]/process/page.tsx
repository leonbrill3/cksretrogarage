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
  const t = await getTranslations({ locale, namespace: 'process' });
  return { title: t('metaTitle'), description: t('intro') };
}

export default async function ProcessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('process');

  const steps = ['brief', 'search', 'inspect', 'verify', 'custody', 'deliver'] as const;

  return (
    <div className="pt-28">
      {/* Intro */}
      <section className="container-site py-16">
        <div className="max-w-3xl">
          <div className="eyebrow mb-6">{t('eyebrow')}</div>
          <h1 className="h-display text-4xl text-bone md:text-6xl">{t('title')}</h1>
          <p className="mt-7 text-lg leading-relaxed text-bone-muted">{t('intro')}</p>
        </div>
      </section>

      {/* Pull quote over image */}
      <section className="relative my-10 overflow-hidden">
        <Image
          src={carImages(cars[0])[3] ?? carImages(cars[0])[0]}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-ink-900/75" />
        <div className="container-site relative z-10 py-24 text-center">
          <blockquote className="mx-auto max-w-3xl font-serif text-2xl italic leading-snug text-bone md:text-3xl">
            “{t('quote')}”
          </blockquote>
          <div className="mt-6 text-[11px] uppercase tracking-label text-brass">
            Cem Köse — {t('quoteRole')}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="container-site py-16">
        <div className="grid gap-x-12 gap-y-14 md:grid-cols-2">
          {steps.map((s, i) => (
            <div key={s} className="reveal flex gap-6">
              <div className="font-serif text-4xl text-bone/15">0{i + 1}</div>
              <div>
                <h3 className="font-serif text-2xl text-bone">{t(`steps.${s}.title`)}</h3>
                <p className="mt-3 text-sm leading-relaxed text-bone-dim">{t(`steps.${s}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-bone/10 bg-ink-800">
        <div className="container-site flex flex-col items-center gap-6 py-20 text-center">
          <h2 className="h-display max-w-2xl text-3xl text-bone">{t('ctaTitle')}</h2>
          <Link href="/source" className="btn-primary">{t('ctaButton')}</Link>
        </div>
      </section>
    </div>
  );
}
