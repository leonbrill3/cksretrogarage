import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getCar, carImages, carTitle, carText, carList, specEntries } from '@/data/cars';
import { getAgent } from '@/data/agents';
import Gallery from '@/components/Gallery';
import AgentCard from '@/components/AgentCard';

const SITE = 'https://cksretrogarage.com';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const car = getCar(slug);
  if (!car) return {};
  return { title: `${carTitle(car)} — For Sale`, description: carText(car.tagline, locale) };
}

export default async function ForSaleCarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { locale, slug } = await params;
  const { a } = await searchParams;
  setRequestLocale(locale);

  const car = getCar(slug);
  if (!car || !car.forSale) notFound();

  const t = await getTranslations('car');
  const images = carImages(car);
  const agent = getAgent(a);
  const status = car.status || 'available';
  const specs = specEntries(car.specs);
  const price = (car.price || '').trim() || t('priceOnRequest');
  const shareUrl = `${SITE}/${locale}/for-sale/${slug}${agent ? `?a=${agent.id}` : ''}`;

  const statusLabel = t(`status.${status}`);
  const statusClass =
    status === 'sold'
      ? 'bg-ink-700 text-bone-dim'
      : status === 'reserved'
        ? 'bg-oxblood text-bone'
        : 'bg-brass text-ink-900';

  return (
    <article className="pt-28">
      <div className="container-site">
        <Link
          href="/for-sale"
          className="link-underline text-[11px] uppercase tracking-label text-bone-dim hover:text-bone"
        >
          ← {t('forSaleBack')}
        </Link>

        <header className="mt-8 grid gap-8 border-b border-bone/10 pb-12 md:grid-cols-[1.5fr_1fr] md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="eyebrow">{car.year} · {t(`category.${car.category}`)}</span>
              <span className={`px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            <h1 className="h-display text-4xl text-bone md:text-6xl">
              {car.make} {car.model}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-bone-muted">{carText(car.tagline, locale)}</p>
          </div>
          <div className="md:text-right">
            <div className="text-sm text-bone-dim">{t('priceLabel')}</div>
            <div className="mt-1 font-serif text-3xl text-brass">{price}</div>
            {car.location && (
              <div className="mt-3 text-sm text-bone-dim">
                {t('locationLabel')}: <span className="text-bone-muted">{car.location}</span>
              </div>
            )}
          </div>
        </header>
      </div>

      <div className="container-site py-14">
        <Gallery images={images} title={carTitle(car)} />
      </div>

      <div className="container-site grid gap-14 pb-16 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-12">
          <div>
            <div className="eyebrow mb-5">{t('aboutHeading')}</div>
            <p className="text-lg leading-relaxed text-bone-muted">{carText(car.description, locale)}</p>
          </div>

          {specs.length > 0 && (
            <div>
              <div className="eyebrow mb-5">{t('specsHeading')}</div>
              <dl className="grid grid-cols-1 gap-px overflow-hidden border border-bone/10 bg-bone/10 sm:grid-cols-2">
                {specs.map(([key, value]) => (
                  <div key={key} className="bg-ink-800 px-5 py-4">
                    <dt className="text-[11px] uppercase tracking-label text-bone-dim">{t(`spec.${key}`)}</dt>
                    <dd className="mt-1 text-bone">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {carList(car.inspection, locale).length > 0 && (
            <div>
              <div className="eyebrow mb-5">{t('inspectionHeading')}</div>
              <ul className="space-y-4">
                {carList(car.inspection, locale).map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-bone-muted">
                    <span className="mt-1.5 block h-1 w-1 shrink-0 bg-brass" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Co-branded contact */}
        <div className="md:sticky md:top-28 md:self-start">
          <AgentCard
            agent={agent}
            locale={locale}
            carTitle={carTitle(car)}
            carSlug={slug}
            shareUrl={shareUrl}
          />
        </div>
      </div>
    </article>
  );
}
