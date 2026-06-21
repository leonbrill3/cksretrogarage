import carsData from '../../content/cars.json';

// Localized text: English is required; other locales optional (fall back to en).
export type Localized = { en: string; tr?: string };
export type LocalizedList = { en: string[]; tr?: string[] };

// Optional technical spec sheet shown on the private quote page.
export type CarSpecs = {
  mileage?: string;
  transmission?: string;
  engine?: string;
  exterior?: string;
  interior?: string;
};

export type Car = {
  slug: string;
  year: number;
  make: string;
  model: string;
  category: 'grand-touring' | 'sports' | 'rally' | 'collector';
  featured?: boolean;
  // Ordered image filenames stored under /public/cars/<slug>/
  images: string[];
  tagline: Localized;
  description: Localized;
  inspection: LocalizedList;
  // Optional video assets (vertical reels).
  clip?: string;
  film?: string;
  filmPoster?: string;
  // Internal selling fields — NEVER rendered on public pages. Agents quote
  // customers above `minPrice`; minimum & commission stay private.
  sellable?: boolean;
  minPrice?: number; // CK's floor, in `currency`
  currency?: string; // ISO code, e.g. "EUR", "USD", "GBP"
  location?: string;
  specs?: CarSpecs;
  // Public availability: a sold car stays in the collection but shows "Sold"
  // with no Inquire button (only available cars can be inquired about).
  sold?: boolean;
};

export const cars: Car[] = carsData as Car[];

export function getCar(slug: string): Car | undefined {
  return cars.find((c) => c.slug === slug);
}

// Cars an agent may quote (sellable + a minimum price set).
export function sellableCars(): Car[] {
  return cars.filter((c) => c.sellable && typeof c.minPrice === 'number');
}

// Format an amount in a car's currency (falls back to EUR).
export function formatMoney(amount: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString('en-US')}`;
  }
}

// Non-empty spec entries as [key, value] pairs, in display order.
export function specEntries(specs: CarSpecs | undefined): [keyof CarSpecs, string][] {
  if (!specs) return [];
  const order: (keyof CarSpecs)[] = [
    'mileage',
    'transmission',
    'engine',
    'exterior',
    'interior',
  ];
  return order
    .map((k) => [k, (specs[k] || '').trim()] as [keyof CarSpecs, string])
    .filter(([, v]) => v.length > 0);
}

export function carImages(car: Car): string[] {
  // New uploads are absolute refs (/api/media/… or https://…); older entries are
  // bare filenames served from /public/cars/<slug>/.
  return car.images.map((f) => (/^(https?:)?\/\//.test(f) || f.startsWith('/') ? f : `/cars/${car.slug}/${f}`));
}

export function carTitle(car: Car): string {
  return `${car.year} ${car.make} ${car.model}`;
}

// Locale-aware getters: return the requested locale's text, or fall back to en.
export function carText(field: Localized | undefined, locale: string): string {
  if (!field) return '';
  const v = (field as Record<string, string | undefined>)[locale];
  return v && v.trim() ? v : field.en;
}

export function carList(field: LocalizedList | undefined, locale: string): string[] {
  if (!field) return [];
  const v = (field as Record<string, string[] | undefined>)[locale];
  return Array.isArray(v) && v.length ? v : field.en;
}
