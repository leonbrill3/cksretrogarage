import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { cars } from '@/data/cars';

const BASE = 'https://cksretrogarage.com';
const PATHS = ['', '/collection', '/process', '/storage', '/about', '/source', '/contact', '/privacy'];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of routing.locales) {
    for (const p of PATHS) {
      entries.push({
        url: `${BASE}/${locale}${p}`,
        changeFrequency: 'monthly',
        priority: p === '' ? 1 : 0.7,
      });
    }
    for (const car of cars) {
      entries.push({
        url: `${BASE}/${locale}/collection/${car.slug}`,
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  return entries;
}
