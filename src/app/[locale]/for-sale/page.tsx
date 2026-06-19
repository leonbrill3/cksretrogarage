import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { forSaleCars } from '@/data/cars';
import CarCard from '@/components/CarCard';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'forSale' });
  return { title: t('metaTitle'), description: t('intro') };
}

export default async function ForSalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('forSale');
  const tc = await getTranslations('car');
  const listings = forSaleCars();

  const statusLabels = {
    available: tc('status.available'),
    reserved: tc('status.reserved'),
    sold: tc('status.sold'),
  };

  return (
    <div className="container-site pb-28 pt-36">
      <div className="max-w-3xl">
        <div className="eyebrow mb-6">{t('eyebrow')}</div>
        <h1 className="h-display text-4xl text-bone md:text-6xl">{t('title')}</h1>
        <p className="mt-6 text-lg leading-relaxed text-bone-muted">{t('intro')}</p>
        <p className="mt-4 text-sm leading-relaxed text-bone-dim">{t('note')}</p>
      </div>

      {listings.length === 0 ? (
        <div className="mt-16 border border-bone/10 bg-ink-800 p-10 text-center">
          <p className="text-lg text-bone-muted">{t('empty')}</p>
          <Link href="/source" className="btn-primary mt-6 inline-flex">
            {t('emptyCta')}
          </Link>
        </div>
      ) : (
        <div className="mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((car, i) => (
            <CarCard
              key={car.slug}
              car={car}
              priority={i < 3}
              locale={locale}
              hrefBase="for-sale"
              showSale
              statusLabels={statusLabels}
              priceFallback={tc('priceOnRequest')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
