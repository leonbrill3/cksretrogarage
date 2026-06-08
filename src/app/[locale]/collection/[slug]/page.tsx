import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { cars, getCar, carImages, carTitle } from '@/data/cars';
import { routing } from '@/i18n/routing';
import Gallery from '@/components/Gallery';
import FilmPlayer from '@/components/FilmPlayer';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    cars.map((car) => ({ locale, slug: car.slug })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const car = getCar(slug);
  if (!car) return {};
  return { title: carTitle(car), description: car.tagline };
}

export default async function CarPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const car = getCar(slug);
  if (!car) notFound();
  const t = await getTranslations('car');
  const images = carImages(car);

  return (
    <article className="pt-28">
      <div className="container-site">
        <Link
          href="/collection"
          className="link-underline text-[11px] uppercase tracking-label text-bone-dim hover:text-bone"
        >
          ← {t('back')}
        </Link>

        <header className="mt-8 grid gap-8 border-b border-bone/10 pb-12 md:grid-cols-[1.5fr_1fr] md:items-end">
          <div>
            <div className="eyebrow mb-4">{car.year} · {t(`category.${car.category}`)}</div>
            <h1 className="h-display text-4xl text-bone md:text-6xl">
              {car.make} {car.model}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-bone-muted">{car.tagline}</p>
          </div>
          <div className="md:text-right">
            <div className="text-sm text-bone-dim">{t('priceLabel')}</div>
            <div className="mt-1 font-serif text-2xl text-brass">{t('priceValue')}</div>
            <Link href="/source" className="btn-primary mt-5">
              {t('inquire')}
            </Link>
          </div>
        </header>
      </div>

      {car.clip && (
        <div className="container-site pt-14">
          <div className="eyebrow mb-6 text-center">{t('inMotion')}</div>
          <div className="mx-auto w-full max-w-[420px]">
            <div className="relative aspect-[9/16] overflow-hidden bg-ink-900">
              <video
                src={car.clip}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      )}

      <div className="container-site py-14">
        <Gallery images={images} title={carTitle(car)} />
      </div>

      {car.film && car.filmPoster && (
        <section className="border-t border-bone/10 bg-ink-800">
          <div className="container-site py-20">
            <div className="mb-10 text-center">
              <div className="eyebrow mb-4">{t('filmEyebrow')}</div>
              <h2 className="h-display text-3xl text-bone">{t('filmTitle')}</h2>
            </div>
            <FilmPlayer src={car.film} poster={car.filmPoster} title={carTitle(car)} />
          </div>
        </section>
      )}

      <div className="container-site grid gap-14 pb-28 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="eyebrow mb-5">{t('aboutHeading')}</div>
          <p className="text-lg leading-relaxed text-bone-muted">{car.description}</p>
        </div>
        <div className="border-l border-bone/10 pl-8">
          <div className="eyebrow mb-5">{t('inspectionHeading')}</div>
          <ul className="space-y-4">
            {car.inspection.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed text-bone-muted">
                <span className="mt-1.5 block h-1 w-1 shrink-0 bg-brass" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="border-t border-bone/10 bg-ink-800">
        <div className="container-site flex flex-col items-center gap-6 py-20 text-center">
          <h2 className="h-display max-w-2xl text-3xl text-bone">{t('similarTitle')}</h2>
          <p className="max-w-lg text-bone-dim">{t('similarBody')}</p>
          <Link href="/source" className="btn-primary">
            {t('similarCta')}
          </Link>
        </div>
      </section>
    </article>
  );
}
