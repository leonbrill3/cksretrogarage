import carsData from '../../content/cars.json';

// Localized text: English is required; other locales optional (fall back to en).
export type Localized = { en: string; tr?: string };
export type LocalizedList = { en: string[]; tr?: string[] };

export type SaleStatus = 'available' | 'reserved' | 'sold';

// Optional technical spec sheet shown on cars that are for sale.
export type CarSpecs = {
  mileage?: string;
  transmission?: string;
  engine?: string;
  exterior?: string;
  interior?: string;
  vin?: string;
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
  // Sale listing fields — present on cars actively offered for sale.
  forSale?: boolean;
  price?: string; // free text, e.g. "€185,000" or "Price on application"
  status?: SaleStatus;
  location?: string;
  specs?: CarSpecs;
};

export const cars: Car[] = carsData as Car[];

export function getCar(slug: string): Car | undefined {
  return cars.find((c) => c.slug === slug);
}

// Cars actively offered for sale, sold listings sorted to the end.
export function forSaleCars(): Car[] {
  return cars
    .filter((c) => c.forSale)
    .sort((a, b) => Number(a.status === 'sold') - Number(b.status === 'sold'));
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
    'vin',
  ];
  return order
    .map((k) => [k, (specs[k] || '').trim()] as [keyof CarSpecs, string])
    .filter(([, v]) => v.length > 0);
}

export function carImages(car: Car): string[] {
  return car.images.map((f) => `/cars/${car.slug}/${f}`);
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
