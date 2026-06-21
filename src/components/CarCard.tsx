import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Car, carImages, carTitle, carText } from '@/data/cars';

export default async function CarCard({
  car,
  priority,
  locale,
}: {
  car: Car;
  priority?: boolean;
  locale: string;
}) {
  const t = await getTranslations({ locale, namespace: 'car' });
  const cover = carImages(car)[0];
  return (
    <Link href={`/collection/${car.slug}`} className="group reveal block">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-700">
        <Image
          src={cover}
          alt={carTitle(car)}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={priority}
          className={`object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105 ${car.sold ? 'opacity-75' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent opacity-60" />
        {car.sold && (
          <div className="absolute right-3 top-3 bg-ink-900/80 px-3 py-1 text-[10px] uppercase tracking-label text-bone-muted backdrop-blur-sm">
            {t('soldValue')}
          </div>
        )}
      </div>
      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-label text-bone-dim">{car.year}</div>
        <h3 className="mt-1.5 font-serif text-xl text-bone transition-colors group-hover:text-brass">
          {car.make} {car.model}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-bone-dim">{carText(car.tagline, locale)}</p>
      </div>
    </Link>
  );
}
