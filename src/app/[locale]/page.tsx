import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { cars, carImages } from '@/data/cars';
import CarCard from '@/components/CarCard';
import ShowReel from '@/components/ShowReel';

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  const hero = carImages(cars[0])[1] ?? carImages(cars[0])[0];
  const featured = cars.filter((c) => c.featured).slice(0, 3);

  const stats = [
    { value: '30+', key: 'years' },
    { value: '10', key: 'countries' },
    { value: '3', key: 'divisions' },
    { value: '100%', key: 'inspected' },
  ] as const;

  const pillars = ['sourcing', 'inspection', 'custody'] as const;

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-screen items-end overflow-hidden">
        <Image
          src={hero}
          alt="CK Retro Garage"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-ink-900/30" />
        <div className="container-site relative z-10 pb-24 pt-40">
          <div className="eyebrow mb-6">{t('hero.eyebrow')}</div>
          <h1 className="h-display max-w-4xl text-[2.7rem] text-bone sm:text-6xl lg:text-7xl">
            {t('hero.title')}
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-bone-muted">
            {t('hero.subtitle')}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/source" className="btn-primary">
              {t('hero.ctaPrimary')}
            </Link>
            <Link href="/collection" className="btn-ghost">
              {t('hero.ctaSecondary')}
            </Link>
          </div>
        </div>
      </section>

      {/* STAT STRIP */}
      <section className="border-y border-bone/10 bg-ink-800">
        <div className="container-site grid grid-cols-2 divide-bone/10 md:grid-cols-4 md:divide-x">
          {stats.map((s) => (
            <div key={s.key} className="px-2 py-10 text-center">
              <div className="font-serif text-4xl text-brass md:text-5xl">{s.value}</div>
              <div className="mt-3 text-[11px] uppercase tracking-label text-bone-dim">
                {t(`stats.${s.key}`)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER PROMISE */}
      <section className="container-site py-24 md:py-32">
        <div className="grid items-center gap-14 md:grid-cols-2">
          <div className="reveal relative aspect-[4/5] overflow-hidden bg-ink-700">
            <Image
              src={carImages(cars[1])[0]}
              alt={t('founder.imageAlt')}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="reveal">
            <div className="eyebrow mb-6">{t('founder.eyebrow')}</div>
            <h2 className="h-display text-3xl text-bone md:text-4xl">{t('founder.title')}</h2>
            <p className="mt-6 text-base leading-relaxed text-bone-muted">{t('founder.p1')}</p>
            <p className="mt-4 text-base leading-relaxed text-bone-muted">{t('founder.p2')}</p>
            <div className="mt-8">
              <div className="font-serif text-xl text-bone">Cem Köse</div>
              <div className="mt-1 text-[11px] uppercase tracking-label text-brass">
                {t('founder.role')}
              </div>
            </div>
            <Link href="/about" className="link-underline mt-8 inline-block text-sm uppercase tracking-label text-bone-muted hover:text-bone">
              {t('founder.link')} →
            </Link>
          </div>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="border-t border-bone/10 bg-ink-800 py-24">
        <div className="container-site">
          <div className="grid gap-px overflow-hidden border border-bone/10 bg-bone/10 md:grid-cols-3">
            {pillars.map((p, i) => (
              <div key={p} className="reveal bg-ink-800 p-10">
                <div className="font-serif text-5xl text-bone/15">0{i + 1}</div>
                <h3 className="mt-5 font-serif text-2xl text-bone">{t(`pillars.${p}.title`)}</h3>
                <p className="mt-4 text-sm leading-relaxed text-bone-dim">
                  {t(`pillars.${p}.body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED COLLECTION */}
      <section className="container-site py-24 md:py-32">
        <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow mb-5">{t('collection.eyebrow')}</div>
            <h2 className="h-display text-3xl text-bone md:text-5xl">{t('collection.title')}</h2>
          </div>
          <Link href="/collection" className="btn-ghost">
            {t('collection.viewAll')}
          </Link>
        </div>
        <div className="grid gap-x-6 gap-y-12 md:grid-cols-3">
          {featured.map((car, i) => (
            <CarCard key={car.slug} car={car} priority={i === 0} locale={locale} />
          ))}
        </div>
      </section>

      {/* CUSTODY / COLLECTION SUITES — panoramic showroom reel */}
      <section className="border-t border-bone/10 bg-ink-800">
        <div className="container-site py-24 md:py-28">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <div className="eyebrow mb-6">{t('custody.eyebrow')}</div>
            <h2 className="h-display text-3xl text-bone md:text-4xl">{t('custody.title')}</h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-bone-muted">
              {t('custody.body')}
            </p>
          </div>
          <div className="reveal">
            <ShowReel
              src="/showreel/showreel-wide.mp4"
              poster="/showreel/showreel-wide-poster.jpg"
              hint={t('custody.tapSound')}
              aspectClass="aspect-video"
            />
          </div>
          <div className="mt-10 text-center">
            <Link href="/storage" className="btn-ghost">
              {t('custody.cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-bone/10 bg-oxblood-deep">
        <div className="container-site flex flex-col items-center gap-8 py-24 text-center">
          <h2 className="h-display max-w-3xl text-3xl text-bone md:text-5xl">{t('cta.title')}</h2>
          <p className="max-w-xl text-base leading-relaxed text-bone/80">{t('cta.body')}</p>
          <Link
            href="/source"
            className="inline-flex items-center justify-center gap-2 bg-bone px-8 py-4 text-[12px] font-medium uppercase tracking-label text-ink-900 transition-opacity hover:opacity-90"
          >
            {t('cta.button')}
          </Link>
        </div>
      </section>
    </>
  );
}
