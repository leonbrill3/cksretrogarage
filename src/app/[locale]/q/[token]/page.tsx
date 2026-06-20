import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCar, carImages, carTitle, carText, carList, specEntries, formatMoney } from '@/data/cars';
import { getAgent } from '@/data/agents';
import { verifyQuote } from '@/lib/quote';
import Gallery from '@/components/Gallery';
import AgentCard from '@/components/AgentCard';

const SITE = 'https://cksretrogarage.com';

// Private quote pages must never be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function QuotePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const quote = await verifyQuote(token);
  if (!quote) notFound();

  const car = getCar(quote.c);
  const agent = getAgent(quote.a);
  if (!car || !agent) notFound();

  const t = await getTranslations('car');
  const tq = await getTranslations('quote');
  const images = carImages(car);
  const specs = specEntries(car.specs);
  const price = formatMoney(quote.p, car.currency || 'EUR');
  const shareUrl = `${SITE}/${locale}/q/${token}`;

  return (
    <article className="pt-28">
      <div className="container-site">
        <header className="grid gap-8 border-b border-bone/10 pb-12 md:grid-cols-[1.5fr_1fr] md:items-end">
          <div>
            <div className="eyebrow mb-4">{car.year} · {t(`category.${car.category}`)}</div>
            <h1 className="h-display text-4xl text-bone md:text-6xl">
              {car.make} {car.model}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-bone-muted">{carText(car.tagline, locale)}</p>
          </div>
          <div className="md:text-right">
            <div className="text-sm text-bone-dim">{tq('priceLabel')}</div>
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
        <Gallery images={images} title={carTitle(car)} clip={car.clip} />
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

        <div className="md:sticky md:top-28 md:self-start">
          <AgentCard
            agent={agent}
            locale={locale}
            carTitle={carTitle(car)}
            carSlug={car.slug}
            shareUrl={shareUrl}
          />
        </div>
      </div>
    </article>
  );
}
