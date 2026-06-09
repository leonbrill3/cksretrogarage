import carsData from '../../content/cars.json';

// Localized text: English is required; other locales optional (fall back to en).
export type Localized = { en: string; tr?: string };
export type LocalizedList = { en: string[]; tr?: string[] };

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
};

export const cars: Car[] = carsData as Car[];

export function getCar(slug: string): Car | undefined {
  return cars.find((c) => c.slug === slug);
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
