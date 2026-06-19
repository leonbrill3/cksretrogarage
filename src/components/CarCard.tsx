import Image from 'next/image';
import { Link } from '@/i18n/routing';
import { Car, carImages, carTitle, carText } from '@/data/cars';

export default function CarCard({
  car,
  priority,
  locale,
  hrefBase = 'collection',
  showSale = false,
  statusLabels,
  priceFallback,
}: {
  car: Car;
  priority?: boolean;
  locale: string;
  // Link target base: '/collection/<slug>' or '/for-sale/<slug>'.
  hrefBase?: 'collection' | 'for-sale';
  // When true, render price + sale-status badge (used on the For Sale tab).
  showSale?: boolean;
  statusLabels?: { available: string; reserved: string; sold: string };
  priceFallback?: string;
}) {
  const cover = carImages(car)[0];
  const status = car.status || 'available';
  const sold = status === 'sold';
  const price = (car.price || '').trim() || priceFallback || '';

  return (
    <Link href={`/${hrefBase}/${car.slug}`} className="group reveal block">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-700">
        <Image
          src={cover}
          alt={carTitle(car)}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          priority={priority}
          className={`object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105 ${
            sold ? 'grayscale' : ''
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/70 via-transparent to-transparent opacity-60" />
        {showSale && statusLabels && status !== 'available' && (
          <span
            className={`absolute left-0 top-4 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${
              sold ? 'bg-ink-900/90 text-bone-dim' : 'bg-oxblood text-bone'
            }`}
          >
            {statusLabels[status]}
          </span>
        )}
      </div>
      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-label text-bone-dim">{car.year}</div>
        <h3 className="mt-1.5 font-serif text-xl text-bone transition-colors group-hover:text-brass">
          {car.make} {car.model}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-bone-dim">{carText(car.tagline, locale)}</p>
        {showSale && price && (
          <div className="mt-3 font-serif text-lg text-brass">{price}</div>
        )}
      </div>
    </Link>
  );
}
