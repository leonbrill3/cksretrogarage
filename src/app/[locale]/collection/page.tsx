import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { cars } from '@/data/cars';
import CarCard from '@/components/CarCard';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'collection' });
  return { title: t('metaTitle'), description: t('intro') };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('collection');

  return (
    <div className="container-site pb-28 pt-36">
      <div className="max-w-3xl">
        <div className="eyebrow mb-6">{t('eyebrow')}</div>
        <h1 className="h-display text-4xl text-bone md:text-6xl">{t('title')}</h1>
        <p className="mt-6 text-lg leading-relaxed text-bone-muted">{t('intro')}</p>
        <p className="mt-4 text-sm leading-relaxed text-bone-dim">{t('note')}</p>
      </div>

      <div className="mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map((car, i) => (
          <CarCard key={car.slug} car={car} priority={i < 3} />
        ))}
      </div>
    </div>
  );
}
